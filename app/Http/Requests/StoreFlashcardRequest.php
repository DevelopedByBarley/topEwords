<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFlashcardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'word_id' => ['nullable', 'integer', Rule::exists('words', 'id')],
            'front' => ['required', 'string', 'max:10000'],
            'back' => ['required', 'string', 'max:10000'],
            'direction' => ['required', Rule::in(['front_to_back', 'back_to_front', 'both'])],
            'front_notes' => ['nullable', 'string', 'max:5000'],
            'front_speak' => ['nullable', 'string', 'max:1000'],
            'back_notes' => ['nullable', 'string', 'max:5000'],
            'back_speak' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }
}
