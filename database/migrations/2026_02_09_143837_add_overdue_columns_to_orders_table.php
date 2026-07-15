<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up(): void
{
    Schema::table('orders', function (Blueprint $table) {
        $table->boolean('is_overdue')->default(false); // Penanda telat
        $table->integer('overdue_days')->default(0);   // Telat berapa hari
        $table->decimal('overdue_fee', 15, 2)->default(0); // Total nominal denda
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            //
        });
    }
};
