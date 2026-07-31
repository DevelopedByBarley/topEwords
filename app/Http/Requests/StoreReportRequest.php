<?php

namespace App\Http\Requests;

use App\Models\Report;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'category' => ['required', Rule::in(Report::CATEGORIES)],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
            'word_id' => [
                Rule::requiredIf(fn () => $this->input('category') === 'word_data'),
                'nullable',
                'integer',
                Rule::exists('words', 'id'),
            ],
        ];
    }

    /**
     * Magyar, mezőre szabott hibaüzenetek — az alapértelmezett fordítás a
     * nyers mezőnevet ("word id") mutatná a felhasználónak.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'category.required' => 'Válassz kategóriát.',
            'category.in' => 'Ismeretlen kategória.',
            'description.required' => 'Írd le, mit tapasztaltál.',
            'description.min' => 'Írj legalább pár szót, hogy utána tudjunk járni (legalább :min karakter).',
            'description.max' => 'A leírás legfeljebb :max karakter lehet.',
            'word_id.required' => 'Válaszd ki, melyik szóról van szó.',
            'word_id.exists' => 'Ezt a szót nem találjuk — válassz a kereső találatai közül.',
        ];
    }
}
