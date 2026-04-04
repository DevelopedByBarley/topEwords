<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class FlashcardSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'new_cards_per_day' => ['required', 'integer', 'min:1', 'max:9999'],
            'max_reviews_per_day' => ['required', 'integer', 'min:1', 'max:9999'],
            'learning_steps' => ['required', 'array', 'min:1'],
            'learning_steps.*' => ['required', 'integer', 'min:1', 'max:1440'],
            'graduating_interval' => ['required', 'integer', 'min:1', 'max:365'],
            'easy_interval' => ['required', 'integer', 'min:1', 'max:365'],
            'starting_ease' => ['required', 'integer', 'min:130', 'max:999'],
            'easy_bonus' => ['required', 'integer', 'min:100', 'max:999'],
            'hard_interval_modifier' => ['required', 'integer', 'min:100', 'max:999'],
            'interval_modifier' => ['required', 'integer', 'min:10', 'max:999'],
            'max_interval' => ['required', 'integer', 'min:1', 'max:36500'],
            'lapse_new_interval' => ['required', 'integer', 'min:0', 'max:100'],
            'leech_threshold' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }
}
