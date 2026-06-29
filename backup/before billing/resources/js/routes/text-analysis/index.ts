import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../wayfinder'
import youtube from './youtube'
import books from './books'
/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
export const show = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/text-analysis',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.url = (options?: RouteQueryOptions) => {
    return show.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
show.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
const showForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
showForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::show
* @see app/Http/Controllers/TextAnalysisController.php:67
* @route '/text-analysis'
*/
showForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: show.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

show.form = showForm

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
export const fetchSource = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fetchSource.url(options),
    method: 'post',
})

fetchSource.definition = {
    methods: ["post"],
    url: '/text-analysis/fetch-source',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSource.url = (options?: RouteQueryOptions) => {
    return fetchSource.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSource.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: fetchSource.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
const fetchSourceForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fetchSource.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::fetchSource
* @see app/Http/Controllers/TextAnalysisController.php:147
* @route '/text-analysis/fetch-source'
*/
fetchSourceForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: fetchSource.url(options),
    method: 'post',
})

fetchSource.form = fetchSourceForm

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
export const analyze = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: analyze.url(options),
    method: 'post',
})

analyze.definition = {
    methods: ["post"],
    url: '/text-analysis/analyze',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyze.url = (options?: RouteQueryOptions) => {
    return analyze.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyze.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: analyze.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
const analyzeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: analyze.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::analyze
* @see app/Http/Controllers/TextAnalysisController.php:244
* @route '/text-analysis/analyze'
*/
analyzeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: analyze.url(options),
    method: 'post',
})

analyze.form = analyzeForm

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
export const wordLookup = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordLookup.url(options),
    method: 'get',
})

wordLookup.definition = {
    methods: ["get","head"],
    url: '/text-analysis/word-lookup',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.url = (options?: RouteQueryOptions) => {
    return wordLookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookup.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: wordLookup.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
const wordLookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookupForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordLookup
* @see app/Http/Controllers/TextAnalysisController.php:72
* @route '/text-analysis/word-lookup'
*/
wordLookupForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordLookup.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

wordLookup.form = wordLookupForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
export const geminiLookup = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiLookup.url(options),
    method: 'get',
})

geminiLookup.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-lookup',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiLookup.url = (options?: RouteQueryOptions) => {
    return geminiLookup.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiLookup.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiLookup.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiLookup.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
const geminiLookupForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiLookupForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiLookup.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiLookup
* @see app/Http/Controllers/TextAnalysisController.php:1131
* @route '/text-analysis/gemini-lookup'
*/
geminiLookupForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiLookup.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiLookup.form = geminiLookupForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
export const geminiFlashcard = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiFlashcard.url(options),
    method: 'get',
})

geminiFlashcard.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-flashcard',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.url = (options?: RouteQueryOptions) => {
    return geminiFlashcard.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcard.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiFlashcard.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
const geminiFlashcardForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcardForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiFlashcard
* @see app/Http/Controllers/TextAnalysisController.php:804
* @route '/text-analysis/gemini-flashcard'
*/
geminiFlashcardForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiFlashcard.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiFlashcard.form = geminiFlashcardForm

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
export const geminiModels = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiModels.url(options),
    method: 'get',
})

geminiModels.definition = {
    methods: ["get","head"],
    url: '/text-analysis/gemini-models',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiModels.url = (options?: RouteQueryOptions) => {
    return geminiModels.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiModels.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: geminiModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiModels.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: geminiModels.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
const geminiModelsForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiModelsForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiModels.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::geminiModels
* @see app/Http/Controllers/TextAnalysisController.php:1120
* @route '/text-analysis/gemini-models'
*/
geminiModelsForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: geminiModels.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

geminiModels.form = geminiModelsForm

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
export const wordInsight = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordInsight.url(options),
    method: 'get',
})

wordInsight.definition = {
    methods: ["get","head"],
    url: '/text-analysis/word-insight',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.url = (options?: RouteQueryOptions) => {
    return wordInsight.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsight.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: wordInsight.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
const wordInsightForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsightForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::wordInsight
* @see app/Http/Controllers/TextAnalysisController.php:1067
* @route '/text-analysis/word-insight'
*/
wordInsightForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: wordInsight.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

wordInsight.form = wordInsightForm

const textAnalysis = {
    show: Object.assign(show, show),
    fetchSource: Object.assign(fetchSource, fetchSource),
    youtube: Object.assign(youtube, youtube),
    analyze: Object.assign(analyze, analyze),
    wordLookup: Object.assign(wordLookup, wordLookup),
    geminiLookup: Object.assign(geminiLookup, geminiLookup),
    geminiFlashcard: Object.assign(geminiFlashcard, geminiFlashcard),
    geminiModels: Object.assign(geminiModels, geminiModels),
    wordInsight: Object.assign(wordInsight, wordInsight),
    books: Object.assign(books, books),
}

export default textAnalysis