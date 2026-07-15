<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Order;
use App\Models\Service;
use Carbon\Carbon;
use App\Notifications\PaymentReminder; // Import notifikasi tadi

class SendOrderReminders extends Command
{
    protected $signature = 'orders:send-reminders';
    protected $description = 'Kirim email pengingat H-1 sebelum masa sewa habis';

    public function handle()
    {
        $this->info('🚀 Mencari order yang habis besok...');

        // Ambil order Penitipan yang masih aktif
        $orders = Order::where('orderable_type', Service::class)
            ->where('status', 'processing') 
            ->get();

        $tomorrow = Carbon::today('Asia/Jakarta')->addDay(); // Tanggal BESOK
        $count = 0;

        foreach ($orders as $order) {
            $details = $order->user_form_details;
            
            // Hitung Tanggal Selesai (Sama kayak logic denda)
            if (!isset($details['start_date']) || !isset($details['duration_value'])) continue;

            $startDate = Carbon::parse($details['start_date']);
            $duration = (int)$details['duration_value'];
            $unit = $details['duration_unit'];

            $endDate = $startDate->copy();
            if ($unit === 'day') $endDate->addDays($duration);
            elseif ($unit === 'week') $endDate->addWeeks($duration);
            elseif ($unit === 'month') $endDate->addMonths($duration);

            // Cek apakah End Date == BESOK?
            if ($endDate->isSameDay($tomorrow)) {
                
                // Kirim Email ke User Pemilik Order
                $user = $order->user;
                $user->notify(new PaymentReminder($order));

                $this->info("📧 Email dikirim ke: {$user->email} (Order #{$order->id})");
                $count++;
            }
        }

        $this->info("✅ Selesai! {$count} pengingat dikirim.");
    }
}