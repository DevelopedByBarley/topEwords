import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\QuizController::complete
* @see app/Http/Controllers/QuizController.php:11
* @route '/words/quiz/complete'
*/
export const complete = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: complete.url(options),
    method: 'post',
})

complete.definition = {
    methods: ["post"],
    url: '/words/quiz/complete',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\QuizController::complete
* @see app/Http/Controllers/QuizController.php:11
* @route '/words/quiz/complete'
*/
complete.url = (options?: RouteQueryOptions) => {
    return complete.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\QuizController::complete
* @see app/Http/Controllers/QuizController.php:11
* @route '/words/quiz/complete'
*/
complete.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: complete.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\QuizController::complete
* @see app/Http/Controllers/QuizController.php:11
* @route '/words/quiz/complete'
*/
const completeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: complete.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\QuizController::complete
* @see app/Http/Controllers/QuizController.php:11
* @route '/words/quiz/complete'
*/
completeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: complete.url(options),
    method: 'post',
})

complete.form = completeForm

const QuizController = { complete }

export default QuizController