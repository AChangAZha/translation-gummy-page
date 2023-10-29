<script>
import {defineComponent} from 'vue'

export default defineComponent({
  name: "Admin"
})
</script>

<template>
  <div class="flex justify-center items-center h-screen">
    <div class="card w-96 bg-base-100 shadow-xl">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <span class="card-title">管理</span>
          <button class="btn-sm btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </button>
        </div>
        <button class="btn">添加作品信息</button>
        <button class="btn">转录分割</button>
        <button class="btn">翻译分割</button>
        <button class="btn">转录替换</button>
        <button class="btn">翻译替换</button>
        <button class="btn">原字幕文件替换</button>
        <button class="btn">翻译字幕文件替换</button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>