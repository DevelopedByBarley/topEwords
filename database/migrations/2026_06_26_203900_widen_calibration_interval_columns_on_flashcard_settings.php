<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The calibration interval columns are validated up to 365 (days) in
     * FlashcardSettingRequest and the settings UI, but were stored as
     * unsignedTinyInteger (max 255). With MySQL strict mode any value in
     * 256-365 throws an out-of-range error. Widen them to unsignedSmallInteger.
     *
     * @var array<string, int>
     */
    private array $columns = [
        'calib_somewhat_min' => 3,
        'calib_somewhat_max' => 7,
        'calib_know_min' => 8,
        'calib_know_max' => 21,
        'calib_well_min' => 22,
        'calib_well_max' => 50,
    ];

    public function up(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            foreach ($this->columns as $column => $default) {
                $table->unsignedSmallInteger($column)->default($default)->change();
            }
        });
    }

    public function down(): void
    {
        Schema::table('flashcard_settings', function (Blueprint $table) {
            foreach ($this->columns as $column => $default) {
                $table->unsignedTinyInteger($column)->default($default)->change();
            }
        });
    }
};
