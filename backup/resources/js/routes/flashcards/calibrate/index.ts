import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FlashcardCalibrationController::rate
* @see app/Http/Controllers/FlashcardCalibrationController.php:84
* @route '/flashcards/{deck}/calibrate'
*/
export const rate = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: rate.url(args, options),
    method: 'post',
})

rate.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/calibrate',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::rate
* @see app/Http/Controllers/FlashcardCalibrationController.php:84
* @route '/flashcards/{deck}/calibrate'
*/
rate.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return rate.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::rate
* @see app/Http/Controllers/FlashcardCalibrationController.php:84
* @route '/flashcards/{deck}/calibrate'
*/
rate.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: rate.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::rate
* @see app/Http/Controllers/FlashcardCalibrationController.php:84
* @route '/flashcards/{deck}/calibrate'
*/
const rateForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: rate.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::rate
* @see app/Http/Controllers/FlashcardCalibrationController.php:84
* @route '/flashcards/{deck}/calibrate'
*/
rateForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: rate.url(args, options),
    method: 'post',
})

rate.form = rateForm

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::skip
* @see app/Http/Controllers/FlashcardCalibrationController.php:166
* @route '/flashcards/{deck}/calibrate/skip'
*/
export const skip = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: skip.url(args, options),
    method: 'post',
})

skip.definition = {
    methods: ["post"],
    url: '/flashcards/{deck}/calibrate/skip',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::skip
* @see app/Http/Controllers/FlashcardCalibrationController.php:166
* @route '/flashcards/{deck}/calibrate/skip'
*/
skip.url = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return skip.definition.url
            .replace('{deck}', parsedArgs.deck.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::skip
* @see app/Http/Controllers/FlashcardCalibrationController.php:166
* @route '/flashcards/{deck}/calibrate/skip'
*/
skip.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: skip.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::skip
* @see app/Http/Controllers/FlashcardCalibrationController.php:166
* @route '/flashcards/{deck}/calibrate/skip'
*/
const skipForm = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: skip.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FlashcardCalibrationController::skip
* @see app/Http/Controllers/FlashcardCalibrationController.php:166
* @route '/flashcards/{deck}/calibrate/skip'
*/
skipForm.post = (args: { deck: number | { id: number } } | [deck: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: skip.url(args, options),
    method: 'post',
})

skip.form = skipForm

const calibrate = {
    rate: Object.assign(rate, rate),
    skip: Object.assign(skip, skip),
}

export default calibrate