<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderTracking;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    /**
     * Menampilkan detail tugas (order) untuk kurir.
     */
    public function show(string $id)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        // Cari order dan load relasi yang dibutuhkan frontend
        // Pastikan order milik kurir yang sedang login
        $task = Order::with(['user', 'payment', 'orderable', 'trackings'])
            ->where('courier_id', $user->id)
            ->findOrFail($id);

        // Jika rute di web.php mengarah ke 'TaskShow', maka render ini:
        return Inertia::render('Courier/TaskShow', [
            'order' => $task, // Kunci props disamakan dengan 'order' agar match dengan TaskShow.jsx
        ]);
    }

    /**
     * Update status tugas (order) & Upload Bukti Foto
     * Ini endpoint yang dipanggil saat tombol aksi ditekan kurir.
     */
    public function updateStatus(Request $request, string $id)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        // 1. Validasi input
        // Status yang valid diterima dari frontend: 
        // - on_the_way (Kurir OTW)
        // - picked_up  (Barang diambil/jemput)
        // - stored     (Masuk gudang - untuk penitipan)
        // - completed  (Selesai - untuk pindahan langsung)
        $validated = $request->validate([
            'status' => 'required|string|in:on_the_way,picked_up,stored,completed,delivered,cancelled', 
            'evidence_photo' => 'nullable|image|max:10240', // Max 10MB (opsional, wajib di kondisi tertentu di FE)
            'note' => 'nullable|string|max:500',
        ]);

        $task = Order::where('courier_id', $user->id)->findOrFail($id);
        
        // Simpan status baru
        $newStatus = $validated['status'];

        // 2. Handle Upload Foto Bukti
        $evidencePath = null;
        if ($request->hasFile('evidence_photo')) {
            // Simpan di folder storage/app/public/evidence
            $evidencePath = $request->file('evidence_photo')->store('evidence', 'public');
        }

        // 3. Update Status Order di Database
        $task->update([
            'status' => $newStatus,
        ]);

        // 4. Update Status Ketersediaan Kurir (Opsional - sesuaikan logika bisnis)
        // Jika sedang OTW atau bawa barang -> sibuk
        if (in_array($newStatus, ['on_the_way', 'picked_up'])) {
            $user->update(['courier_status' => 'on_delivery']);
        } 
        // Jika selesai -> available lagi
        elseif (in_array($newStatus, ['stored', 'completed', 'cancelled'])) {
            $user->update(['courier_status' => 'available']);
        }

        // 5. Buat Deskripsi Tracking Otomatis
        $desc = match($newStatus) {
            'on_the_way' => 'Kurir sedang menuju lokasi penjemputan.',
            'picked_up' => 'Barang berhasil dijemput kurir dan sedang dibawa.',
            'stored' => 'Barang telah sampai dan masuk ke gudang penyimpanan.',
            'completed', 'delivered' => 'Pesanan selesai. Barang telah diserahkan.',
            'cancelled' => 'Pengiriman dibatalkan oleh kurir.',
            default => 'Status pesanan diperbarui.'
        };

        if (!empty($validated['note'])) {
            $desc .= " (Catatan Kurir: " . $validated['note'] . ")";
        }

        // 6. Simpan Riwayat Tracking (OrderTracking)
        OrderTracking::create([
            'order_id' => $task->id,
            'status' => strtoupper(str_replace('_', ' ', $newStatus)),
            'description' => $desc,
            'evidence_photo_path' => $evidencePath, // Path foto bukti disimpan di sini
            'created_at' => now(),
        ]);

        return redirect()->back()->with('success', 'Status berhasil diperbarui!');
    }

    /**
     * Update lokasi Real-time Kurir
     * Endpoint ini dipanggil oleh navigator.geolocation di Frontend
     */
    public function updateLocation(Request $request)
    {
        $request->validate([
            'lat' => 'required', 
            'lng' => 'required',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();

        $user->update([
            'latitude' => $request->lat,
            'longitude' => $request->lng,
        ]);
        
        return response()->json(['status' => 'ok']);
    }
    
    /**
     * Tambah Catatan Manual (Tracking Note)
     */
    public function addTrackingNote(Request $request, string $id)
    {
        $request->validate([
            'note' => 'required|string|max:255'
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $task = Order::where('courier_id', $user->id)->findOrFail($id);

        OrderTracking::create([
            'order_id' => $task->id,
            'status' => 'INFO KURIR',
            'description' => $request->note,
            'created_at' => now(),
        ]);

        return redirect()->back()->with('success', 'Catatan perjalanan ditambahkan.');
    }
}