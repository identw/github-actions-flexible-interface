export function getColorScheme() {
    return window.getComputedStyle(document.querySelector('body')).colorScheme;
}