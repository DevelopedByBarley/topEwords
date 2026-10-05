<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
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
