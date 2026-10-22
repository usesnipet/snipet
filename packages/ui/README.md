# @snipet/ui

Snipet's design tokens (colors, radius, font) for Tailwind v4, shared by `apps/web` and `apps/site`.

```css
@import "tailwindcss";
@import "@snipet/ui/theme.css";
```

Colors use `light-dark()`: pages follow the system theme, and a `.light` or `.dark` class on an ancestor pins it.
