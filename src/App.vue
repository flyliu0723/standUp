<template>
  <router-view />
</template>

<script setup lang="ts">
</script>

<style lang="scss">
@use '@/styles/tokens.scss';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  font-family: var(--font-body);
  background: var(--color-bg);
  background-image: var(--color-bg-gradient);
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button,
input,
select,
textarea {
  font-family: inherit;
}

::selection {
  background: rgba(22, 163, 74, 0.2);
  color: #0f172a;
}
</style>
