import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardStudyController::submit
* @see app/Http/Controllers/FlashcardStudyController.php:78
* @route '/flashcards/{deck}/study'
*/
export const submit = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: submit.url(args, options),
    method: 'post',
})

submit.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/study',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardStudyController::submit
* @see app/Http/Controllers/FlashcardStudyController.php:78
* @route '/flashcards/{deck}/study'
*/
submit.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return submit.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardStudyController::submit
* @see app/Http/Controllers/FlashcardStudyController.php:78
* @route '/flashcards/{deck}/study'
*/
submit.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: submit.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardStudyController::submit
* @see app/Http/Controllers/FlashcardStudyController.php:78
* @route '/flashcards/{deck}/study'
*/
const submitForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: submit.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardStudyController::submit
* @see app/Http/Controllers/FlashcardStudyController.php:78
* @route '/flashcards/{deck}/study'
*/
submitForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: submit.url(args, options),
    method: 'post',
})

submit.form = submitForm

/**
* @see \App\Http\Controllers\FlashcardStudyController::undo
* @see app/Http/Controllers/FlashcardStudyController.php:100
* @route '/flashcards/{deck}/study/undo'
*/
export const undo = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: undo.url(args, options),
    method: 'post',
})

undo.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/study/undo',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardStudyController::undo
* @see app/Http/Controllers/FlashcardStudyController.php:100
* @route '/flashcards/{deck}/study/undo'
*/
undo.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { deck: args }
    }

    if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
        args = { deck: args.id }
    }

    if (Array.isArray(args)) {
        args = {
            deck: args[0],
        }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
        deck: typeof args.deck === 'object'
        ? args.deck.id
        : args.deck,
    }

    return undo.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardStudyController::undo
* @see app/Http/Controllers/FlashcardStudyController.php:100
* @route '/flashcards/{deck}/study/undo'
*/
undo.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: undo.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardStudyController::undo
* @see app/Http/Controllers/FlashcardStudyController.php:100
* @route '/flashcards/{deck}/study/undo'
*/
const undoForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: undo.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardStudyController::undo
* @see app/Http/Controllers/FlashcardStudyController.php:100
* @route '/flashcards/{deck}/study/undo'
*/
undoForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: undo.url(args, options),
    method: 'post',
})

undo.form = undoForm

const study = {
    submit: Object.assign(submit, submit),
    undo: Object.assign(undo, undo),
}

export default study