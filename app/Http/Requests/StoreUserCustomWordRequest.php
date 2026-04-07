<?php

namespace App\Http\Requests;

use App\Models\Word;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserCustomWordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'word' => [
                'required',
                'string',
                'max:100',
                Rule::unique('user_custom_words')->where('user_id', $this->user()->id),
                function (string $attribute, mixed $value, \Closure $fail) {
                    $lower = mb_strtolower(trim($value));
                    $exists = Word::where('word', $lower)
                        ->orWhere('form_base', $lower)
                        ->orWhere('verb_past', $lower)
                        ->orWhere('verb_past_participle', $lower)
                        ->orWhere('verb_present_participle', $lower)
                        ->orWhere('verb_third_person', $lower)
                        ->orWhere('noun_plural', $lower)
                        ->orWhere('adj_comparative', $lower)
                        ->orWhere('adj_superlative', $lower)
                        ->exists();

                    if ($exists) {
                        $fail('Ez a szó már szerepel a fő szólistában, ott jelölheted be a státuszát.');
                    }
                },
            ],
            'meaning_hu' => ['nullable', 'string', 'max:255'],
            'part_of_speech' => ['nullable', 'string', 'max:20'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', 'in:known,learning,saved,pronunciation'],
        ];
    }
}
