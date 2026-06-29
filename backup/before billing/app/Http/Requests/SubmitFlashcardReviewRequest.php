<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitFlashcardReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'flashcard_id' => ['required', 'integer', 'exists:flashcards,id'],
            'direction' => ['required', 'in:front_to_back,back_to_front'],
            'rating' => ['required', 'integer', 'min:1', 'max:4'],
        ];
    }
}
