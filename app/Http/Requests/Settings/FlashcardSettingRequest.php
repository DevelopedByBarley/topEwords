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
     * An unchecked checkbox is omitted from the request, so coerce it to a real
     * boolean — otherwise shuffle_cards can never be turned back off.
     */
    protected function prepareForValidation(): void
    {
        $this->merge(['shuffle_cards' => $this->boolean('shuffle_cards')]);
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
            'shuffle_cards' => ['boolean'],
            'calib_somewhat_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'calib_somewhat_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'calib_know_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'calib_know_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'calib_well_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'calib_well_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'learning_steps' => 'tanulási lépések',
            'learning_steps.*' => 'tanulási lépés',
            'calib_somewhat_min' => '„Valamennyire" minimum',
            'calib_somewhat_max' => '„Valamennyire" maximum',
            'calib_know_min' => '„Tudom" minimum',
            'calib_know_max' => '„Tudom" maximum',
            'calib_well_min' => '„Jól tudom" minimum',
            'calib_well_max' => '„Jól tudom" maximum',
        ];
    }
}
