<?php

use Illuminate\Support\Facades\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

// ... command bawaan laravel lain ...

// === JADWALKAN ROBOT DENDA DI SINI ===
Schedule::command('orders:check-overdue')
    ->dailyAt('00:01') // Jalan setiap jam 12 malam lewat 1 menit
    ->timezone('Asia/Jakarta'); // Wajib set timezone biar gak ngaco

Schedule::command('orders:send-reminders')
    ->dailyAt('08:00')
    ->timezone('Asia/Jakarta');