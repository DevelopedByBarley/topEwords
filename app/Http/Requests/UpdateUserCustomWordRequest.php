<?php

namespace App\Http\Requests;

use App\Models\UserCustomWord;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserCustomWordRequest extends FormRequest
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
                'sometimes',
                'string',
                'max:100',
                Rule::unique('user_custom_words')
                    ->where('user_id', $this->user()->id)
                    ->ignore($this->route('customWord')),
                function (string $attribute, mixed $value, \Closure $fail) {
                    /** @var UserCustomWord $customWord */
                    $customWord = $this->route('customWord');

                    // Változatlan szó nem átnevezés — akkor is átengedjük, ha a
                    // felvétele óta bekerült ugyanez a szó a fő listába.
                    if (mb_strtolower(trim($value)) === mb_strtolower($customWord->word)) {
                        return;
                    }

                    (StoreUserCustomWordRequest::notInMainWordList())($attribute, $value, $fail);
                },
            ],
            'meaning_hu' => ['nullable', 'string', 'max:255'],
            'extra_meanings' => ['nullable', 'string', 'max:500'],
            'synonyms' => ['nullable', 'string', 'max:255'],
            'part_of_speech' => ['nullable', 'string', 'max:20'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'example_hu' => ['nullable', 'string', 'max:500'],
            'form_base' => ['nullable', 'string', 'max:100'],
            'verb_past' => ['nullable', 'string', 'max:100'],
            'verb_past_participle' => ['nullable', 'string', 'max:100'],
            'verb_present_participle' => ['nullable', 'string', 'max:100'],
            'verb_third_person' => ['nullable', 'string', 'max:100'],
            'is_irregular' => ['boolean'],
            'noun_plural' => ['nullable', 'string', 'max:100'],
            'adj_comparative' => ['nullable', 'string', 'max:100'],
            'adj_superlative' => ['nullable', 'string', 'max:100'],
            'extra_forms' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:known,learning,saved,pronunciation,practice'],
            'importance' => ['nullable', 'integer', 'min:1', 'max:5'],
        ];
    }
}
