import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\AdminController::toggle
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
export const toggle = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggle.url(options),
    method: 'post',
})

toggle.definition = {
    methods: ["post"],
    url: '/admin/ai-access',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\AdminController::toggle
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggle.url = (options?: RouteQueryOptions) => {
    return toggle.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\AdminController::toggle
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggle.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: toggle.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggle
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
const toggleForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggle.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\AdminController::toggle
* @see app/Http/Controllers/AdminController.php:75
* @route '/admin/ai-access'
*/
toggleForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
    action: toggle.url(options),
    method: 'post',
})

toggle.form = toggleForm

const aiAccess = {
    toggle: Object.assign(toggle, toggle),
}

export default aiAccess