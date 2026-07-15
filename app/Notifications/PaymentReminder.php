<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue; // 1. Wajib import ini buat Queue
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\Order;

// 2. Tambahkan "implements ShouldQueue" di sini agar masuk antrean
class PaymentReminder extends Notification implements ShouldQueue
{
    use Queueable;

    protected $order;

    /**
     * Create a new notification instance.
     */
    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // Mengirim ke Email ('mail') dan menyimpan notif di database aplikasi ('database')
        return ['mail', 'database']; 
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Ambil nama barang (fallback ke 'Barang Titipan' jika null)
        $itemName = $this->order->orderable->name ?? 'Barang Titipan';
        
        // Buat link ke detail order
        $orderUrl = url('/user/my-orders/' . $this->order->id);
        
        return (new MailMessage)
            ->subject('⚠️ Peringatan: Masa Sewa Berakhir Besok!') // Subject Email
            ->greeting('Halo, ' . $notifiable->name . '!') // Sapaan
            ->line('Kami ingin mengingatkan bahwa masa penitipan untuk barang:')
            ->line('📦 **' . $itemName . '** (Order #' . $this->order->id . ')')
            ->line('Akan berakhir pada **BESOK**. Mohon segera dijadwalkan pengambilan barang.')
            ->line('Jika pengambilan melewati batas waktu, akan dikenakan biaya denda harian (Overdue Fee).')
            ->action('Lihat Pesanan Saya', $orderUrl) // Tombol Aksi
            ->line('Terima kasih telah mempercayakan barang Anda kepada kami.');
    }

    /**
     * Get the array representation of the notification.
     * (Untuk disimpan di tabel notifications database)
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'order_id' => $this->order->id,
            'title' => 'Masa Sewa Hampir Habis',
            'message' => 'Masa sewa order #' . $this->order->id . ' berakhir besok. Segera ambil barang Anda.',
            'link' => '/user/my-orders/' . $this->order->id,
            'type' => 'reminder' // Penanda tipe notifikasi
        ];
    }
}