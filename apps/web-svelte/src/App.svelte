<script lang="ts">
  import TestPannel from "@lib/components/WSTestPannel.svelte";
</script>

{#if import.meta.env.VITE_ENV === "development"}
  <TestPannel />
{/if}
