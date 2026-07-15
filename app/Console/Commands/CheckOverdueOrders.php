<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Order;
use App\Models\Service; // Pastikan Model Service (Penitipan) di-import
use Carbon\Carbon;

class CheckOverdueOrders extends Command
{
    // Nama panggilan robotnya nanti
    protected $signature = 'orders:check-overdue';
    protected $description = 'Cek order penitipan yang telat dan hitung denda otomatis';

    public function handle()
    {
        $this->info('🚀 Memulai pengecekan keterlambatan...');

        // 1. Ambil order Penitipan yang statusnya masih aktif (processing/disimpan)
        // Kita anggap 'processing' = barang sedang di gudang
        $orders = Order::where('orderable_type', Service::class)
            ->whereIn('status', ['processing', 'stored']) // Sesuaikan status "Barang Disimpan" di app-mu
            ->get();

        $today = Carbon::now('Asia/Jakarta')->startOfDay();
        $adminFee = 10000; // Biaya Admin Keterlambatan (Opsional)

        $count = 0;

        foreach ($orders as $order) {
            $details = $order->user_form_details;

            // Pastikan data tanggal ada
            if (!isset($details['start_date']) || !isset($details['duration_value'])) continue;

            $startDate = Carbon::parse($details['start_date']);
            $duration = (int)$details['duration_value'];
            $unit = $details['duration_unit'];

            // 2. Hitung Kapan Seharusnya Selesai (Due Date)
            $endDate = $startDate->copy();
            if ($unit === 'day') $endDate->addDays($duration);
            elseif ($unit === 'week') $endDate->addWeeks($duration);
            elseif ($unit === 'month') $endDate->addMonths($duration);

            // 3. Cek Apakah HARI INI > TANGGAL SELESAI?
            if ($today->gt($endDate)) {
                
                // Hitung telat berapa hari
                $lateDays = $endDate->diffInDays($today);

                // Rumus Denda: (Total Harga / Durasi) * Hari Telat
                // Contoh: Sewa 100rb/2hari. Telat 1 hari. Denda = 50rb.
                $dailyRate = $order->final_amount / ($duration * ($unit == 'week' ? 7 : ($unit == 'month' ? 30 : 1))); 
                $penalty = ($lateDays * $dailyRate) + $adminFee;

                // 4. Update Database
                $order->update([
                    'is_overdue' => true,
                    'overdue_days' => $lateDays,
                    'overdue_fee' => ceil($penalty), // Bulatkan ke atas
                    'status' => 'overdue' // Status baru biar Admin noticenya gampang
                ]);

                $this->error("⚠️ Order #{$order->id} telat {$lateDays} hari. Denda: Rp " . number_format($penalty));
                $count++;
            }
        }

        $this->info("✅ Selesai! {$count} order terdeteksi telat.");
    }
}