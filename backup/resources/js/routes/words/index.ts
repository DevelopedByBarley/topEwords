import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../wayfinder'
import practice58e2df from './practice'
import quiz20b74c from './quiz'
/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/words',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::index
* @see app/Http/Controllers/WordController.php:22
* @route '/words'
*/
indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: index.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

index.form = indexForm

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
export const search = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: search.url(options),
    method: 'get',
})

search.definition = {
    methods: ["get","head"],
    url: '/words/search',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
search.url = (options?: RouteQueryOptions) => {
    return search.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
search.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
search.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: search.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
const searchForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
searchForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::search
* @see app/Http/Controllers/WordController.php:205
* @route '/words/search'
*/
searchForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: search.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

search.form = searchForm

/**
* @see \App\Http\Controllers\WordController::update
* @see app/Http/Controllers/WordController.php:490
* @route '/words/{word}'
*/
export const update = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/words/{word}',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\WordController::update
* @see app/Http/Controllers/WordController.php:490
* @route '/words/{word}'
*/
update.url = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { word: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { word: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            word: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        word: typeof args.word === 'object'
        ? args.word.id
        : args.word,
    }

    return update.definition.url
            .replace('{word}', parsedArgs.word.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::update
* @see app/Http/Controllers/WordController.php:490
* @route '/words/{word}'
*/
update.patch = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\WordController::update
* @see app/Http/Controllers/WordController.php:490
* @route '/words/{word}'
*/
const updateForm = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

/**
* @see \App\Http\Controllers\WordController::update
* @see app/Http/Controllers/WordController.php:490
* @route '/words/{word}'
*/
updateForm.patch = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: update.url(args, {
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'PATCH',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'post',
})

update.form = updateForm

/**
* @see \App\Http\Controllers\WordController::status
* @see app/Http/Controllers/WordController.php:518
* @route '/words/{word}/status'
*/
export const status = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

status.definition = {
    methods: ["post"],
    url: '/words/{word}/status',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\WordController::status
* @see app/Http/Controllers/WordController.php:518
* @route '/words/{word}/status'
*/
status.url = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { word: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { word: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            word: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        word: typeof args.word === 'object'
        ? args.word.id
        : args.word,
    }

    return status.definition.url
            .replace('{word}', parsedArgs.word.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::status
* @see app/Http/Controllers/WordController.php:518
* @route '/words/{word}/status'
*/
status.post = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\WordController::status
* @see app/Http/Controllers/WordController.php:518
* @route '/words/{word}/status'
*/
const statusForm = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\WordController::status
* @see app/Http/Controllers/WordController.php:518
* @route '/words/{word}/status'
*/
statusForm.post = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: status.url(args, options),
    method: 'post',
})

status.form = statusForm

/**
* @see \App\Http\Controllers\WordController::importance
* @see app/Http/Controllers/WordController.php:555
* @route '/words/{word}/importance'
*/
export const importance = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importance.url(args, options),
    method: 'post',
})

importance.definition = {
    methods: ["post"],
    url: '/words/{word}/importance',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\WordController::importance
* @see app/Http/Controllers/WordController.php:555
* @route '/words/{word}/importance'
*/
importance.url = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { word: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { word: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            word: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        word: typeof args.word === 'object'
        ? args.word.id
        : args.word,
    }

    return importance.definition.url
            .replace('{word}', parsedArgs.word.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::importance
* @see app/Http/Controllers/WordController.php:555
* @route '/words/{word}/importance'
*/
importance.post = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: importance.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\WordController::importance
* @see app/Http/Controllers/WordController.php:555
* @route '/words/{word}/importance'
*/
const importanceForm = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importance.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\WordController::importance
* @see app/Http/Controllers/WordController.php:555
* @route '/words/{word}/importance'
*/
importanceForm.post = (args: { word: number | { id: number } } | [word: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: importance.url(args, options),
    method: 'post',
})

importance.form = importanceForm

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
export const practice = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: practice.url(options),
    method: 'get',
})

practice.definition = {
    methods: ["get","head"],
    url: '/words/practice',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
practice.url = (options?: RouteQueryOptions) => {
    return practice.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
practice.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: practice.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
practice.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: practice.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
const practiceForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: practice.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
practiceForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: practice.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::practice
* @see app/Http/Controllers/WordController.php:232
* @route '/words/practice'
*/
practiceForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: practice.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

practice.form = practiceForm

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
export const cloze = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: cloze.url(options),
    method: 'get',
})

cloze.definition = {
    methods: ["get","head"],
    url: '/words/cloze',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
cloze.url = (options?: RouteQueryOptions) => {
    return cloze.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
cloze.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: cloze.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
cloze.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: cloze.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
const clozeForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: cloze.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
clozeForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: cloze.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\ClozeController::cloze
* @see app/Http/Controllers/ClozeController.php:14
* @route '/words/cloze'
*/
clozeForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: cloze.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

cloze.form = clozeForm

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
export const quiz = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: quiz.url(options),
    method: 'get',
})

quiz.definition = {
    methods: ["get","head"],
    url: '/words/quiz',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
quiz.url = (options?: RouteQueryOptions) => {
    return quiz.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
quiz.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: quiz.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
quiz.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: quiz.url(options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
const quizForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: quiz.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
quizForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: quiz.url(options),
    method: 'get',
})

/**
* @see \App\Http\Controllers\WordController::quiz
* @see app/Http/Controllers/WordController.php:261
* @route '/words/quiz'
*/
quizForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
    action: quiz.url({
        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
            _method: 'HEAD',
            ...(options?.query ?? options?.mergeQuery ?? {}),
        }
    }),
    method: 'get',
})

quiz.form = quizForm

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:764
* @route '/words/sentence-check'
*/
export const sentenceCheck = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: sentenceCheck.url(options),
    method: 'post',
})

sentenceCheck.definition = {
    methods: ["post"],
    url: '/words/sentence-check',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:764
* @route '/words/sentence-check'
*/
sentenceCheck.url = (options?: RouteQueryOptions) => {
    return sentenceCheck.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:764
* @route '/words/sentence-check'
*/
sentenceCheck.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: sentenceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:764
* @route '/words/sentence-check'
*/
const sentenceCheckForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sentenceCheck.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::sentenceCheck
* @see app/Http/Controllers/TextAnalysisController.php:764
* @route '/words/sentence-check'
*/
sentenceCheckForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: sentenceCheck.url(options),
    method: 'post',
})

sentenceCheck.form = sentenceCheckForm

const words = {
    index: Object.assign(index, index),
    search: Object.assign(search, search),
    update: Object.assign(update, update),
    status: Object.assign(status, status),
    importance: Object.assign(importance, importance),
    practice: Object.assign(practice, practice58e2df),
    cloze: Object.assign(cloze, cloze),
    quiz: Object.assign(quiz, quiz20b74c),
    sentenceCheck: Object.assign(sentenceCheck, sentenceCheck),
}

export default words