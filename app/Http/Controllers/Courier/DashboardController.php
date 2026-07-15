<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use App\Models\Order; // [WAJIB] Import Model Order agar tidak error

class DashboardController extends Controller
{
    /**
     * Menampilkan Dashboard Kurir
     */
    public function index()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        // 1. AMBIL TUGAS AKTIF (Untuk Tab "Tugas Berjalan")
        // Ini akan mengambil semua order yang statusnya sedang diproses oleh kurir
        $activeTasks = Order::with(['user', 'orderable']) // Load data user & barang
            ->where('courier_id', $user->id)
            ->whereIn('status', [
                'courier_assigned', // Status awal saat admin assign kurir (PENTING)
                'on_the_way',       // Kurir sedang jalan
                'picked_up',        // Barang sudah diangkut
                'ready_for_pickup', // Jaga-jaga jika menggunakan status ini
                'processing'        // Jaga-jaga jika status processing dianggap aktif
            ])
            ->latest()
            ->get();

        // 2. AMBIL RIWAYAT (Untuk Tab "Riwayat")
        // Ini mengambil order yang sudah selesai atau dibatalkan
        $completedTasks = Order::with(['user', 'orderable'])
            ->where('courier_id', $user->id)
            ->whereIn('status', ['stored', 'completed', 'cancelled', 'rejected'])
            ->latest()
            ->limit(20) // Batasi 20 terakhir agar ringan
            ->get();

        // 3. HITUNG STATISTIK
        $stats = [
            'active' => $activeTasks->count(),
            // Menghitung total pekerjaan yang sukses (masuk gudang / completed)
            'completed' => Order::where('courier_id', $user->id)
                ->whereIn('status', ['stored', 'completed'])
                ->count(),
            'rating' => 5.0, // Placeholder (bisa diganti real rating nanti)
        ];

        // 4. Render ke Tampilan Dashboard
        // PENTING: Nama key array harus sama dengan props di Dashboard.jsx
        return Inertia::render('Courier/Dashboard', [
            'activeTasks' => $activeTasks,
            'completedTasks' => $completedTasks,
            'stats' => $stats,
        ]);
    }

    /**
     * Fitur Toggle Status Online/Offline
     */
    public function toggleStatus(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        // Logika switch: Jika available jadi offline, dan sebaliknya
        $newStatus = $user->courier_status === 'available' ? 'offline' : 'available';

        // Update ke database
        $user->update(['courier_status' => $newStatus]);

        return back()->with('success', 'Status Anda sekarang: ' . ucfirst($newStatus));
    }
}