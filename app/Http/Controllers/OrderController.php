<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Service;
use App\Models\MovingPackage;
use App\Models\Branch;
use App\Models\ManualPayment;
use App\Models\ActivityLog;
use App\Models\User;
use App\Notifications\PaymentSubmitted;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon; // Import Carbon untuk waktu

class OrderController extends Controller
{
    // Konfigurasi Limit Order Harian (Gabungan Pindahan & Penitipan Pickup)
    const DAILY_ARMADA_LIMIT = 3;

    /**
     * Helper Private: Menghitung jarak antara dua koordinat (Haversine Formula)
     */
    private function calculateDistance($lat1, $lon1, $lat2, $lon2)
    {
        if (($lat1 == $lat2) && ($lon1 == $lon2)) {
            return 0;
        }

        $theta = $lon1 - $lon2;
        $dist = sin(deg2rad($lat1)) * sin(deg2rad($lat2)) +  cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * cos(deg2rad($theta));
        $dist = acos($dist);
        $dist = rad2deg($dist);
        $miles = $dist * 60 * 1.1515;
        $km = $miles * 1.609344;

        return round($km, 2);
    }

    /**
     * Helper Private: Cek Kuota Harian (Gabungan Pindahan & Pickup)
     * Mengembalikan true jika tanggal penuh.
     */
    private function isDateFullyBooked($date)
    {
        // 1. Hitung Order Pindahan di Tanggal Tersebut
        $movingCount = Order::where('orderable_type', MovingPackage::class)
            ->whereNotIn('status', ['cancelled', 'rejected'])
            ->get()
            ->filter(function ($order) use ($date) {
                return isset($order->user_form_details['tanggal_pindahan']) &&
                       $order->user_form_details['tanggal_pindahan'] === $date;
            })
            ->count();

        // 2. Hitung Order Penitipan (Service) yang Minta Pickup di Tanggal Tersebut
        $pickupCount = Order::where('orderable_type', Service::class)
            ->whereNotIn('status', ['cancelled', 'rejected'])
            ->get()
            ->filter(function ($order) use ($date) {
                $details = $order->user_form_details;
                // Cek apakah start_date sama DAN method-nya pickup
                return isset($details['start_date']) &&
                       $details['start_date'] === $date &&
                       isset($details['delivery_method']) &&
                       $details['delivery_method'] === 'pickup';
            })
            ->count();

        $totalUsage = $movingCount + $pickupCount;

        return $totalUsage >= self::DAILY_ARMADA_LIMIT;
    }

    /**
     * Mengambil detail produk & Data Tanggal Penuh untuk modal.
     */
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string|in:service,moving_package',
            'id' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }

        $type = $request->query('type');
        $id = $request->query('id');

        $product = null;
        $productModelClass = null;
        $blockedDates = []; 

        // --- LOGIKA MENGHITUNG TANGGAL PENUH (GABUNGAN) ---
        $allActiveOrders = Order::whereNotIn('status', ['cancelled', 'rejected'])->get();
        $dateUsage = [];

        foreach ($allActiveOrders as $order) {
            $date = null;
            $usesArmada = false;

            if ($order->orderable_type === MovingPackage::class) {
                $date = $order->user_form_details['tanggal_pindahan'] ?? null;
                $usesArmada = true;
            }
            elseif ($order->orderable_type === Service::class) {
                $date = $order->user_form_details['start_date'] ?? null;
                $method = $order->user_form_details['delivery_method'] ?? 'drop_off';
                if ($method === 'pickup') {
                    $usesArmada = true;
                }
            }

            if ($date && $usesArmada) {
                if (!isset($dateUsage[$date])) {
                    $dateUsage[$date] = 0;
                }
                $dateUsage[$date]++;
            }
        }

        foreach ($dateUsage as $date => $count) {
            if ($count >= self::DAILY_ARMADA_LIMIT) {
                $blockedDates[] = $date;
            }
        }
        // ----------------------------------------------------

        if ($type === 'service') {
            $product = Service::findOrFail($id);
            $productModelClass = Service::class;
        } elseif ($type === 'moving_package') {
            $product = MovingPackage::findOrFail($id);
            $productModelClass = MovingPackage::class;
        }

        return response()->json([
            'product' => $product,
            'productType' => $type,
            'productModelClass' => $productModelClass,
            'blockedDates' => $blockedDates,
        ]);
    }

    public function calculateShipping(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'vehicle_type' => 'required_if:delivery_method,pickup',
            'delivery_method' => 'required|in:pickup,dropoff',
        ]);

        if ($request->delivery_method === 'dropoff') {
            return response()->json([
                'options' => [],
                'message' => 'Antar sendiri (Gratis Ongkir)'
            ]);
        }

        $userLat = $request->latitude;
        $userLng = $request->longitude;
        
        $branches = Branch::where('status', 'Buka')->get();
        $options = [];

        foreach ($branches as $branch) {
            if (!$branch->latitude || !$branch->longitude) continue;

            $km = $this->calculateDistance($userLat, $userLng, $branch->latitude, $branch->longitude);

            $ratePerKm = 2500;
            $baseFee = 0;

            switch ($request->vehicle_type) {
                case 'motor': $baseFee = 10000; $ratePerKm = 2500; break;
                case 'pickup': $baseFee = 50000; $ratePerKm = 4000; break;
                case 'truck': $baseFee = 150000; $ratePerKm = 7000; break;
            }

            $shippingCost = 0;
            $note = "";

            if ($km <= 3) {
                if ($request->vehicle_type === 'motor') {
                    $shippingCost = 0;
                    $note = "Promo Jarak Dekat (< 3KM): Ongkir GRATIS!";
                } else {
                    $shippingCost = $baseFee;
                    $note = "Jarak Dekat (< 3KM): Hanya dikenakan biaya sewa armada.";
                }
            } else {
                $rawCost = ($km * $ratePerKm) + $baseFee;
                $shippingCost = ceil($rawCost);
                $note = "Tarif Normal";
            }

            if ($shippingCost > 0) {
                $shippingCost = ceil($shippingCost / 500) * 500;
            }

            $options[] = [
                'branch' => $branch, 
                'distance' => $km,
                'shipping_cost' => $shippingCost,
                'note' => $note
            ];
        }

        if (empty($options)) {
            return response()->json(['error' => 'Tidak ada cabang tersedia saat ini.'], 404);
        }

        usort($options, function ($a, $b) {
            return $a['shipping_cost'] <=> $b['shipping_cost'];
        });

        return response()->json([
            'options' => $options, 
            'vehicle' => $request->vehicle_type
        ]);
    }

    /**
     * STORE: Menyimpan Order Baru
     */
    public function store(Request $request)
    {
        // ====================================================
        // 1. PENJAGAAN JAM OPERASIONAL (ROLLING DOOR DIGITAL)
        // ====================================================
        $now = Carbon::now('Asia/Jakarta');
        $currentHour = $now->hour;

        // Buka 07:00 - 21:00
        if ($currentHour < 7 || $currentHour >= 21) {
            return response()->json([
                'message' => 'Maaf, layanan kami sedang tutup. Jam Operasional: 07:00 - 21:00 WIB.'
            ], 403);
        }
        // ====================================================

        $modelClass = $request->input('product_model');

        $rules = [
            'product_id' => 'required|integer',
            'product_model' => 'required|string',
            'form_details' => 'required|array',
            'form_details.latitude' => 'nullable', 
            'form_details.longitude' => 'nullable',
            'form_details.shipping_cost' => 'nullable|numeric',
        ];

        // --- VALIDASI SERVICE (PENITIPAN) ---
        if ($modelClass === Service::class) {
            $rules['form_details.branch_id'] = 'required|exists:branches,id';
            
            $rules = array_merge($rules, [
                'form_details.start_date' => 'required|date|after_or_equal:today',
                'form_details.duration_value' => 'required|integer|min:1',
                'form_details.duration_unit' => 'required|string|in:hour,day,week,month',
                'form_details.delivery_method' => 'required|string|in:drop_off,pickup',
                'form_details.item_photo' => 'nullable|image|max:5120',
                'form_details.quantity' => 'required|integer|min:1', 
                'form_details.notes' => 'nullable|string|max:1000',
            ]);

            // Jika Pickup, WAJIB isi jam pickup
            if ($request->input('form_details.delivery_method') === 'pickup') {
                $rules['form_details.alamat_penjemputan'] = 'required|string|max:500';
                $rules['form_details.telepon'] = 'required|string|max:20';
                $rules['form_details.pickup_time'] = 'required|date_format:H:i'; // [BARU] Wajib isi jam
            }
        } 
        // --- VALIDASI MOVING (PINDAHAN) ---
        elseif ($modelClass === MovingPackage::class) {
            $rules = array_merge($rules, [
                'form_details.tanggal_pindahan' => 'required|date|after_or_equal:today',
                'form_details.pickup_time' => 'required|date_format:H:i', // [BARU] Wajib isi jam
                'form_details.telepon' => 'required|string|max:20',
                'form_details.alamat_penjemputan' => 'required|string|max:2000',
                'form_details.alamat_tujuan' => 'required|string|max:2000',
                'form_details.notes' => 'nullable|string|max:1000',
                'form_details.origin_latitude' => 'required|numeric',
                'form_details.origin_longitude' => 'required|numeric',
                'form_details.destination_latitude' => 'required|numeric',
                'form_details.destination_longitude' => 'required|numeric',
            ]);
        }

        $validatedData = $request->validate($rules);
        $formDetails = $validatedData['form_details'];

        // --- VALIDASI KHUSUS JAM PENJEMPUTAN (07:00 - 21:00) ---
        if (isset($formDetails['pickup_time'])) {
            $timeParts = explode(':', $formDetails['pickup_time']);
            $hour = (int) $timeParts[0];
            if ($hour < 7 || $hour >= 21) {
                throw ValidationException::withMessages([
                    'form_details.pickup_time' => 'Jam penjemputan harus antara pukul 07:00 sampai 21:00 WIB.'
                ]);
            }
        }
        // -----------------------------------------------------

        // --- VALIDASI KUOTA ARMADA ---
        $checkDate = null;
        if ($modelClass === MovingPackage::class) {
            $checkDate = $formDetails['tanggal_pindahan'];
        } elseif ($modelClass === Service::class && $formDetails['delivery_method'] === 'pickup') {
            $checkDate = $formDetails['start_date'];
        }

        if ($checkDate) {
            if ($this->isDateFullyBooked($checkDate)) {
                $fieldError = ($modelClass === MovingPackage::class) ? 'form_details.tanggal_pindahan' : 'form_details.start_date';
                throw ValidationException::withMessages([
                    $fieldError => 'Mohon maaf, kuota armada penjemputan untuk tanggal ini sudah penuh.'
                ]);
            }
        }
        // -----------------------------

        if ($request->hasFile('form_details.item_photo')) {
            $path = $request->file('form_details.item_photo')->store('order_items', 'public');
            $formDetails['item_photo_path'] = $path;
            $formDetails['item_photo'] = null;
            unset($formDetails['item_photo']);
        }

        $product = $modelClass::find($validatedData['product_id']);
        
        if (!empty($formDetails['branch_id'])) {
            $branch = Branch::find($formDetails['branch_id']);
            $formDetails['branch_name'] = $branch ? $branch->name : 'Unknown';
            $formDetails['branch_address'] = $branch ? $branch->address : '';
        }

        if (!$product) {
            throw ValidationException::withMessages(['product_id' => 'Produk tidak ditemukan.']);
        }

        // Kalkulasi Harga Final
        $finalAmount = 0;

        if ($modelClass === Service::class) {
            $basePrice = $product->price;
            $duration = (int) $formDetails['duration_value'];
            $quantity = isset($formDetails['quantity']) ? (int) $formDetails['quantity'] : 1;

            $timeMultiplier = match ($formDetails['duration_unit']) {
                'hour' => 0.1,
                'day' => 1,
                'week' => 6,
                'month' => 25,
                'year' => 300, 
                default => 1,
            };

            $servicePrice = round($basePrice * $duration * $timeMultiplier * $quantity);
            $shippingCost = isset($formDetails['shipping_cost']) ? (int) $formDetails['shipping_cost'] : 0;
            $finalAmount = $servicePrice + $shippingCost;

        } 
        elseif ($modelClass === MovingPackage::class) {
            $distanceKm = $this->calculateDistance(
                $formDetails['origin_latitude'],
                $formDetails['origin_longitude'],
                $formDetails['destination_latitude'],
                $formDetails['destination_longitude']
            );

            if (!is_null($product->max_distance) && $distanceKm > $product->max_distance) {
                throw ValidationException::withMessages([
                    'form_details.alamat_tujuan' => 'Jarak pengiriman (' . $distanceKm . ' KM) melebihi batas maksimal paket ini (' . $product->max_distance . ' KM). Silakan pilih paket Luar Kota.'
                ]);
            }

            $basePrice = $product->price;
            $pricePerKm = $product->price_per_km;
            $freeDistance = 3;

            $extraDistance = max(0, $distanceKm - $freeDistance);
            $distanceSurcharge = ceil($extraDistance) * $pricePerKm;
            $finalAmount = $basePrice + $distanceSurcharge;

            $formDetails['distance_km'] = $distanceKm;
            $formDetails['distance_surcharge'] = $distanceSurcharge;
        }

        $quantityToSave = isset($formDetails['quantity']) ? (int) $formDetails['quantity'] : 1;
        $noteToSave = isset($formDetails['notes']) ? $formDetails['notes'] : null;

        $order = $product->orders()->create([
            'user_id' => Auth::id(),
            'final_amount' => $finalAmount,
            'quantity' => $quantityToSave,
            'note' => $noteToSave,
            'user_form_details' => $formDetails,
            'status' => 'awaiting_payment',
        ]);

        ActivityLog::record(
            'ORDER_PLACED', 
            'Pesanan baru #' . $order->id . ' masuk dari ' . Auth::user()->name
        );

        return response()->json([
            'message' => 'Order berhasil dibuat',
            'order' => $order
        ]);
    }

    /**
     * Menyimpan bukti pembayaran.
     */
    public function submitPayment(Request $request, Order $order)
    {
        if ($order->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'payment_proof' => 'required|image|mimes:jpeg,png,jpg,pdf|max:2048',
            'notes'         => 'nullable|string|max:500',
        ]);

        $path = null;
        if ($request->hasFile('payment_proof')) {
            $existingPayment = $order->payment;
            if ($existingPayment && $existingPayment->payment_proof_path) {
                 Storage::disk('public')->delete($existingPayment->payment_proof_path);
            }
            $path = $request->file('payment_proof')->store('payments', 'public');
        }

        $order->payment()->updateOrCreate(
            ['order_id' => $order->id],
            [
                'user_id' => Auth::id(),
                'payment_proof_path' => $path,
                'notes' => $request->notes,
                'amount' => $order->final_amount,
                'status' => 'pending_verification'
            ]
        );

        $order->update(['status' => 'awaiting_verification']);

        try {
            $admins = User::where('role', 'admin')->get();
            Notification::send($admins, new PaymentSubmitted($order));
        } catch (\Exception $e) {
            // Log::error('Gagal kirim notif: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Bukti pembayaran berhasil diupload.',
            'orderStatus' => $order->status,
        ]);
    }

    public function getStatus(Order $order)
    {
        if ($order->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'status' => $order->status
        ]);
    }
}