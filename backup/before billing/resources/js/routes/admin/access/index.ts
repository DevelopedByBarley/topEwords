import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\AdminController::set
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
export const set = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: set.url(options),
    method: 'post',
})

set.definition = {
    methods: ["post"],
    url: '/admin/access',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::set
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
set.url = (options?: RouteQueryOptions) => {
    return set.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::set
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
set.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: set.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::set
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
const setForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::set
* @see app/Http/Controllers/AdminController.php:146
* @route '/admin/access'
*/
setForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: set.url(options),
    method: 'post',
})

set.form = setForm

const access = {
    set: Object.assign(set, set),
}

export default access