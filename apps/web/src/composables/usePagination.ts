import { ref, computed } from 'vue'

export function usePagination(initialPerPage = 20) {
  const page = ref(1)
  const perPage = ref(initialPerPage)
  const total = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / perPage.value))
  const hasNext = computed(() => page.value < totalPages.value)
  const hasPrev = computed(() => page.value > 1)

  function nextPage() {
    if (hasNext.value) page.value++
  }

  function prevPage() {
    if (hasPrev.value) page.value--
  }

  function goToPage(p: number) {
    if (p >= 1 && p <= totalPages.value) page.value = p
  }

  function setTotal(value: number) {
    total.value = value
  }

  function reset() {
    page.value = 1
    total.value = 0
  }

  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
    goToPage,
    setTotal,
    reset,
  }
}
