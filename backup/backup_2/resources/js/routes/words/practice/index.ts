import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\TextAnalysisController::check
* @see app/Http/Controllers/TextAnalysisController.php:855
* @route '/words/practice/check'
*/
export const check = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: check.url(options),
    method: 'post',
})

check.definition = {
    methods: ["post"],
    url: '/words/practice/check',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\TextAnalysisController::check
* @see app/Http/Controllers/TextAnalysisController.php:855
* @route '/words/practice/check'
*/
check.url = (options?: RouteQueryOptions) => {
    return check.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\TextAnalysisController::check
* @see app/Http/Controllers/TextAnalysisController.php:855
* @route '/words/practice/check'
*/
check.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: check.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::check
* @see app/Http/Controllers/TextAnalysisController.php:855
* @route '/words/practice/check'
*/
const checkForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: check.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\TextAnalysisController::check
* @see app/Http/Controllers/TextAnalysisController.php:855
* @route '/words/practice/check'
*/
checkForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: check.url(options),
    method: 'post',
})

check.form = checkForm

const practice = {
    check: Object.assign(check, check),
}

export default practice