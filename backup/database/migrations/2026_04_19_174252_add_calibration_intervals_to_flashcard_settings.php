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
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('calib_somewhat_min')->default(3)->after('shuffle_cards');
            $table->unsignedTinyInteger('calib_somewhat_max')->default(7)->after('calib_somewhat_min');
            $table->unsignedTinyInteger('calib_know_min')->default(8)->after('calib_somewhat_max');
            $table->unsignedTinyInteger('calib_know_max')->default(21)->after('calib_know_min');
            $table->unsignedTinyInteger('calib_well_min')->default(22)->after('calib_know_max');
            $table->unsignedTinyInteger('calib_well_max')->default(50)->after('calib_well_min');
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            $table->dropColumn([
                'calib_somewhat_min', 'calib_somewhat_max',
                'calib_know_min', 'calib_know_max',
                'calib_well_min', 'calib_well_max',
            ]);
        });
    }
};
