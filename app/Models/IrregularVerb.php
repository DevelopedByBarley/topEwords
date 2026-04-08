<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['infinitive', 'past_simple', 'past_participle', 'meaning_hu', 'example_en', 'notes'])]
class IrregularVerb extends Model {}
