<script setup xmlns="http://www.w3.org/1999/html">
import {computed, inject, onMounted, reactive, ref} from 'vue';
import Artplayer from "./Artplayer.vue";

const axios = inject('axios');

const task = reactive({
  url: '',
  id: '',
  transcribe_status: '',
  translate_status: '',
  translate_engine: 'ai',
  transcribe_only: false,
  create_time: '',
  update_time: '',
  video_url: '',
  message: '',
  transcribe_no: 0,
  translate_no: 0,
  origin_subtitle_path: '',
  translated_subtitle_path: '',
});

const url = ref('');
const disableAI = ref(false);
const translateOn = ref(true);
const translateEngine = ref('ai');
const kaggleUsername = ref('');
const kaggleKey = ref('');
const openAIKey = ref('');
const inputTaskId = ref('');

const isDialogOpen = ref(false);
const requesting = ref(false);
const taskCacheList = ref([]);
const transcribePriorityTaskList = ref([]);

const error = computed(() => {
  return task.transcribe_status === 'failed' || task.translate_status === 'failed';
});

const success = computed(() => {
  if (translateOn.value) {
    return task.transcribe_status === 'success' && task.translate_status === 'success';
  } else {
    return task.transcribe_status === 'success';
  }
});

const priority = computed(() => {
  return task.transcribe_status === 'priority' || task.translate_status === 'priority';
});

const processing = computed(() => {
  return !error.value && !success.value && !pending.value && !requesting.value;
});

const pending = computed(() => {
  return task.transcribe_status === 'pending' && task.translate_status === 'pending';
});

const subtitleType = ref(0);
const option = computed(() => {
  let subtitle_url
  if (subtitleType.value === 0) {
    subtitle_url = task.origin_subtitle_path
  } else {
    subtitle_url = task.translated_subtitle_path
  }
  return {
    url: import.meta.env.VITE_ALIST_HOST + '/d' + task.video_url,
    fullscreen: true,
    subtitleOffset: true,
    playbackRate: true,
    aspectRatio: true,
    flip: true,
    subtitle: {
      url: import.meta.env.VITE_ALIST_HOST + '/d' + subtitle_url,
    },
    setting: true,
    autoPlayback: true,
  }
});
const playerOpen = ref(false);
const openPlayer = (type) => {
  subtitleType.value = type;
  const player = document.getElementById('player');
  playerOpen.value = true;
  player.showModal();
};

const getInstance = (art) => {
  console.info(art);
};

const origin_subtitle_url = computed(() => {
  return task.origin_subtitle_path ? import.meta.env.VITE_ALIST_HOST + task.origin_subtitle_path.split('/').slice(0,
      -1).join('/') : '';
});

const translated_subtitle_url = computed(() => {
  return task.origin_subtitle_path ? import.meta.env.VITE_ALIST_HOST + task.translated_subtitle_path.split('/').slice(0,
      -1).join('/') : '';
});

onMounted(() => {
  kaggleUsername.value = localStorage.getItem('kaggleUsername') || '';
  kaggleKey.value = localStorage.getItem('kaggleKey') || '';
  openAIKey.value = localStorage.getItem('openAIKey') || '';
  let taskList = localStorage.getItem('task_list');
  if (taskList) {
    taskCacheList.value = JSON.parse(taskList);
  }
  taskList = localStorage.getItem('transcribe_priority_task_list');
  if (taskList) {
    transcribePriorityTaskList.value = JSON.parse(taskList);
  }
  setInterval(() => {
    runBackgroundTask();
  }, 60000);
});

const closeInfo = () => {
  localStorage.setItem('kaggleUsername', kaggleUsername.value);
  localStorage.setItem('kaggleKey', kaggleKey.value);
  localStorage.setItem('openAIKey', openAIKey.value);
  checkInput();
};

const openInfo = () => {
  const info = document.getElementById('info');
  info.showModal();
};

const openRecent = () => {
  const recent = document.getElementById('recent');
  recent.showModal();
};

const copy = () => {
  const taskInfo = document.getElementById('task_info');
  const text = taskInfo.innerText;
  navigator.clipboard.writeText(text);
};

const checkInput = () => {
  if (url.value === '') {
    return;
  }
  if (!url.value.startsWith(import.meta.env.VITE_ALIST_HOST) && openAIKey.value === '') {
    disableAI.value = true;
    translateEngine.value = 'google';
  } else {
    disableAI.value = false;
  }
};

const taskTimer = ref({});
const clearAllTimer = () => {
  for (const key of Object.keys(taskTimer.value)) {
    clearInterval(taskTimer.value[key]);
  }
  taskTimer.value = {};
}

const reset = () => {
  task.id = '';
  task.url = '';
  task.transcribe_status = '';
  task.translate_status = '';
  task.translate_engine = 'ai';
  task.transcribe_only = false;
  task.create_time = '';
  task.update_time = '';
  task.video_url = '';
  task.message = '';
  task.transcribe_no = 0;
  task.translate_no = 0;
  task.origin_subtitle_path = '';
  task.translated_subtitle_path = '';
};

const closeDialog = () => {
  clearAllTimer();
  reset();
  isDialogOpen.value = false;
};

const throwError = (e) => {
  console.log(e)
  task.transcribe_status = 'failed';
  task.translate_status = 'failed';
  if (e.response && e.response.data) {
    if (e.response.data.error === 'Invalid URL') {
      task.message = '该视频暂不支持。';
    } else {
      task.message = e.response.data.error;
    }
  }
  if (!task.message) {
    task.message = '未知错误。';
  }
  requesting.value = false;
};

const runBackgroundTask = () => {
  if (isDialogOpen.value || Object.keys(taskTimer.value).length !== 0 || transcribePriorityTaskList.value.length === 0) {
    return;
  }
  length = transcribePriorityTaskList.value.length;
  const task = transcribePriorityTaskList.value[length - 1];
  createTask(task.url, translateEngine.value, !translateOn.value, task.kaggle_username, task.kaggle_key,
      task.ai_key);
};

const findCacheTask = (task_id, task_list) => {
  for (let i = 0; i < task_list.value.length; i++) {
    if (task_list.value[i].id === task_id) {
      return task_list.value[i];
    }
  }
  return null;
};

const addLocalTask = (url, id, task_list) => {
  task_list.value.unshift({
    id: id,
    url: url,
    update_time: new Date().toLocaleString(),
    kaggle_username: kaggleUsername.value,
    kaggle_key: kaggleKey.value,
    ai_key: openAIKey.value,
  });
};

const updateLocalTask = (cache_task) => {
  cache_task.update_time = new Date().toLocaleString();
  cache_task.kaggle_username = kaggleUsername.value;
  cache_task.kaggle_key = kaggleKey.value;
  cache_task.ai_key = openAIKey.value;
};

const cacheTask = (task_id, task_url, transcribe_status, translate_status) => {
  const cache_task = findCacheTask(task_id, taskCacheList);
  const cache_transcribe_priority_task = findCacheTask(task_id, transcribePriorityTaskList);
  if (cache_transcribe_priority_task) {
    if (transcribe_status !== "priority") {
      transcribePriorityTaskList.value.splice(transcribePriorityTaskList.value.indexOf(cache_transcribe_priority_task),
          1);
    } else {
      updateLocalTask(cache_transcribe_priority_task);
    }
  } else if (kaggleUsername.value !== '' && kaggleKey.value !== '' && transcribe_status === "priority") {
    addLocalTask(task_url, task_id, transcribePriorityTaskList);
  }
  if (cache_task) {
    updateLocalTask(cache_task);
  } else {
    addLocalTask(task_url, task_id, taskCacheList);
  }
  localStorage.setItem('task_list', JSON.stringify(taskCacheList.value));
  localStorage.setItem('transcribe_priority_task_list', JSON.stringify(transcribePriorityTaskList.value));
};

const update = (data) => {
  task.id = data.id;
  task.url = data.url;
  task.transcribe_only = data.transcribe_only;
  task.transcribe_status = data.transcribe_status;
  task.translate_status = data.transcribe_status === 'failed' ? 'failed' : data.translate_status;
  task.translate_engine = data.translate_engine === 'google' ? 'Google Translate' : 'AI';
  task.create_time = data.create_time;
  task.update_time = data.update_time;
  task.video_url = data.video_url;
  task.origin_subtitle_path = data.origin_subtitle_path;
  task.translated_subtitle_path = data.translated_subtitle_path;
  task.transcribe_no = data.transcribe_no;
  task.translate_no = data.translate_no;
  task.message = data.message;
  if (task.translate_status === 'success' || task.translate_status === 'failed') {
    clearInterval(taskTimer.value[data.id]);
  }
  if ((task.transcribe_status === 'success' || task.transcribe_status === 'failed') && !translateOn.value) {
    clearInterval(taskTimer.value[data.id]);
  }
};

const queryTask = (task_id) => {
  if (task_id === '') {
    return;
  }
  isDialogOpen.value = true;
  clearAllTimer();
  reset();
  task.id = task_id;
  getTask(task_id);
  requesting.value = true;
  const modal = document.getElementById('modal');
  modal.showModal();
};

const getTask = (id) => {
  axios.get('/task?id=' + id).then((response) => {
    const data = response.data;
    if (data.redirect) {
      getTask(data.redirect);
      cacheTask(data.id, data.url, data.transcribe_status, data.translate_status);
      return;
    }
    update(data);
    cacheTask(data.id, data.url, data.transcribe_status, data.translate_status);
    requesting.value = false;
  }).catch((e) => {
    throwError(e);
  }).finally(() => {
  });
};

const start = () => {
  if (url.value === '') {
    const video = document.getElementById('video');
    video.focus();
    return;
  }
  isDialogOpen.value = true;
  clearAllTimer();
  reset();
  task.url = url.value;
  createTask();
  const modal = document.getElementById('modal');
  requesting.value = true;
  modal.showModal();
};

const restart = () => {
  requesting.value = true;
  clearAllTimer();
  createTask();
};

const refresh = (task_id) => {
  const refreshButton = document.getElementById('refresh');
  if (refreshButton.disabled) {
    return;
  }
  getTask(task_id);
  refreshButton.disabled = true;
  setTimeout(() => {
    refreshButton.disabled = false;
  }, 120000);
};

const createTask = (url = task.url, translate_engine = translateEngine.value,
                    transcribe_only = !translateOn.value, kaggle_username = kaggleUsername.value,
                    kaggle_key = kaggleKey.value, ai_key = openAIKey.value) => {
  axios.post('/task', {
    url: url,
    translate_engine: translate_engine,
    transcribe_only: transcribe_only,
    kaggle_username: kaggle_username,
    kaggle_key: kaggle_key,
    ai_key: ai_key,
  }).then((response) => {
    const data = response.data;
    if (taskTimer.value[data.id]) {
      clearAllTimer();
    }
    if (data.redirect && isDialogOpen.value) {
      taskTimer.value[data.redirect] = setInterval(() => {
        getTask(data.redirect);
      }, 30000);
      getTask(data.redirect);
      cacheTask(data.id, data.url, data.transcribe_status, data.translate_status);
      return;
    }
    update(data);
    cacheTask(data.id, data.url, data.transcribe_status, data.translate_status);
    requesting.value = false;
    if (data.transcribe_status === "priority") {
      taskTimer.value[data.id] = setInterval(() => {
        createTask(url, translate_engine, transcribe_only, kaggle_username, kaggle_key, ai_key);
      }, 60000);
    } else if (isDialogOpen.value) {
      taskTimer.value[data.id] = setInterval(() => {
        getTask(data.id);
      }, 30000);
    }
  }).catch((e) => {
    throwError(e);
  }).finally(() => {
  });
};

</script>

<template>
  <div class="flex justify-center items-center h-screen">
    <div class="max-w-md mx-auto bg-base-100 rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
      <div class="md:flex">
        <div class="md:shrink-0">
          <img class="h-48 w-full object-contain md:h-full md:w-64 pb-6" src="/translation_gummy.png" alt="">
        </div>
        <div class="md:pl-6 space-y-2">
          <input type="text" id="video" placeholder="视频地址" @blur="checkInput" v-model="url"
                 class="input input-bordered w-full max-w-2xl"/>
          <div class="alert alert-info" id="tip">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 class="stroke-current shrink-0 w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p>站外视频仅支持谷歌翻译。</p>
            </div>
          </div>
          <div class="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none"
                 viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>请不要转录或翻译任何违规内容。</span>
          </div>
          <div class="form-control" id="translationDiv">
            <label class="label cursor-pointer">
              <span class="label-text">翻译字幕</span>
              <input type="checkbox" id="toggleCheckbox" class="toggle toggle-primary" v-model="translateOn"/>
            </label>
          </div>
          <select class="select select-bordered w-full max-w-2xl" id="translationSelect" v-model="translateEngine"
                  :disabled="!translateOn">
            <option selected id="gpt" value="ai" :disabled="disableAI">AI翻译</option>
            <option id="google" value="google">谷歌翻译</option>
          </select>
          <div class="card-actions justify-end">
            <button class="btn btn-square" @click="openInfo">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </button>
            <button class="btn" id="find" @click="openRecent">
              找回字幕
            </button>
            <button class="btn btn-primary" id="button" @click="start" :disabled="isDialogOpen">
              <span class="loading loading-spinner" v-if="isDialogOpen"></span>
              开始
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <dialog id="modal" class="modal" @close="closeDialog">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </form>
      <div class="pb-2">
        <h3 class="font-bold text-lg" v-if="requesting">请稍候……</h3>
        <div v-else>
          <h3 class="font-bold text-lg" v-if="pending">正在排队中……</h3>
          <h3 class="font-bold text-lg" v-if="processing">正在处理中……</h3>
          <h3 class="font-bold text-lg" v-if="error">错误</h3>
          <h3 class="font-bold text-lg" v-if="success">已完成</h3>
        </div>
      </div>
      <span v-if="requesting">
        正在处理请求。
      </span>
      <div v-if="!requesting">
        <p v-if="task.id" class="mb-2 overflow-auto">任务编号：{{ task.id }}</p>
        <div v-if="pending||processing" class="alert alert-info mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span v-if="!priority">
            可关闭该页面，任务将继续进行，后续可点击网页中的【找回字幕】按钮查找历史任务。</span>
          <span v-if="priority">
            请勿关闭该网页或清除浏览器缓存，否则可能会造成字幕丢失。</span>
        </div>
        <div class="alert alert-error mb-2" v-if="error && task.message">
          <span>{{ task.message }}</span>
        </div>
        <div class="alert mb-2">
          <svg v-if="task.transcribe_status === 'pending'"
               xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
               class="h-6 w-6" viewBox="0,0,256,256">
            <g fill="#a6acba" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt"
               stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"
               font-family="none" font-size="none" style="mix-blend-mode: normal">
              <g transform="scale(10.66667,10.66667)">
                <path
                    d="M12,2c-5.511,0 -10,4.489 -10,10c0,5.511 4.489,10 10,10c5.511,0 10,-4.489 10,-10c0,-5.511 -4.489,-10 -10,-10zM12,4c4.43012,0 8,3.56988 8,8c0,4.43012 -3.56988,8 -8,8c-4.43012,0 -8,-3.56988 -8,-8c0,-4.43012 3.56988,-8 8,-8zM11,6v6.41406l4.29297,4.29297l1.41406,-1.41406l-3.70703,-3.70703v-5.58594z"></path>
              </g>
            </g>
          </svg>
          <span v-else-if="task.transcribe_status === 'processing' || task.transcribe_status==='priority'"
                class="loading loading-spinner"></span>
          <svg v-else-if="task.transcribe_status === 'failed'" xmlns="http://www.w3.org/2000/svg"
               class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <svg v-else-if="task.transcribe_status === 'success'" xmlns="http://www.w3.org/2000/svg"
               class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span v-if="task.transcribe_status === 'pending'">正在排队，前方还有{{
              task.transcribe_no
            }}个转录任务。</span>
          <span
              v-else-if="task.transcribe_status === 'processing' || task.transcribe_status==='priority'">正在转录中……</span>
          <span v-else-if="task.transcribe_status === 'success'">转录已完成。
            <a v-if="task.video_url" class="inline-block mx-1 align-text-top" href="javascript:void(0);" target="_self"
               @click="openPlayer(0)">
              <svg viewBox="0 0 24 24" class="h-5" fill="none" xmlns="http://www.w3.org/2000/svg"><g
                  id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round"
                                                                 stroke-linejoin="round"></g><g
                  id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd"
                                                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM10.6935 15.8458L15.4137 13.059C16.1954 12.5974 16.1954 11.4026 15.4137 10.941L10.6935 8.15419C9.93371 7.70561 9 8.28947 9 9.21316V14.7868C9 15.7105 9.93371 16.2944 10.6935 15.8458Z"
                                                  fill="#a6acba"></path> </g></svg>
            </a>
            <a class="inline-block align-text-top" :href="origin_subtitle_url">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5" viewBox="0 0 24 24"
                   fill="none">
                <g id="SVGRepo_bgCarrier" stroke-width="0"/>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
                <g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd"
                                                   d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12ZM12 6.25C12.4142 6.25 12.75 6.58579 12.75 7V12.1893L14.4697 10.4697C14.7626 10.1768 15.2374 10.1768 15.5303 10.4697C15.8232 10.7626 15.8232 11.2374 15.5303 11.5303L12.5303 14.5303C12.3897 14.671 12.1989 14.75 12 14.75C11.8011 14.75 11.6103 14.671 11.4697 14.5303L8.46967 11.5303C8.17678 11.2374 8.17678 10.7626 8.46967 10.4697C8.76256 10.1768 9.23744 10.1768 9.53033 10.4697L11.25 12.1893V7C11.25 6.58579 11.5858 6.25 12 6.25ZM8 16.25C7.58579 16.25 7.25 16.5858 7.25 17C7.25 17.4142 7.58579 17.75 8 17.75H16C16.4142 17.75 16.75 17.4142 16.75 17C16.75 16.5858 16.4142 16.25 16 16.25H8Z"
                                                   fill="#a6acba"/> </g>
              </svg>
              </a></span>
          <span v-else-if="task.transcribe_status === 'failed'">转录未完成。</span>
        </div>
        <div class="alert mb-2">
          <svg
              v-if="task.translate_status === 'pending' || task.transcribe_only"
              xmlns="http://www.w3.org/2000/svg"
              x="0px" y="0px"
              class="h-6 w-6" viewBox="0,0,256,256">
            <g fill="#a6acba" fill-rule="nonzero" stroke="none" stroke-width="1" stroke-linecap="butt"
               stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0"
               font-family="none" font-size="none" style="mix-blend-mode: normal">
              <g transform="scale(10.66667,10.66667)">
                <path
                    d="M12,2c-5.511,0 -10,4.489 -10,10c0,5.511 4.489,10 10,10c5.511,0 10,-4.489 10,-10c0,-5.511 -4.489,-10 -10,-10zM12,4c4.43012,0 8,3.56988 8,8c0,4.43012 -3.56988,8 -8,8c-4.43012,0 -8,-3.56988 -8,-8c0,-4.43012 3.56988,-8 8,-8zM11,6v6.41406l4.29297,4.29297l1.41406,-1.41406l-3.70703,-3.70703v-5.58594z"></path>
              </g>
            </g>
          </svg>
          <span v-else-if="task.translate_status === 'processing'" class="loading loading-spinner"></span>
          <svg v-else-if="task.translate_status === 'failed'" xmlns="http://www.w3.org/2000/svg"
               class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <svg v-else-if="task.translate_status === 'success'" xmlns="http://www.w3.org/2000/svg"
               class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span v-if="task.transcribe_only">仅转录该视频，无翻译。</span>
          <span
              v-else-if="task.transcribe_status === 'pending' || task.transcribe_status === 'priority' || task.transcribe_status === 'processing'">等待转录完成。
            <text>（翻译引擎：{{ task.translate_engine }}）</text>
          </span>
          <span v-else-if="task.transcribe_status === 'failed'">翻译未完成。</span>
          <span v-else-if="task.transcribe_status === 'success'">
            <span v-if="task.translate_status === 'pending'">正在排队，前方还有{{
                task.translate_no
              }}个翻译任务。</span>
            <span
                v-else-if="task.translate_status === 'processing' || task.translate_status === 'priority'">正在翻译中……</span>
            <span v-else-if="task.translate_status === 'success'">翻译已完成。
              <a v-if="task.video_url" class="inline-block mx-1 align-text-top" href="javascript:void(0);"
                 @click="openPlayer(1)"
                 target="_self">
                <svg viewBox="0 0 24 24" class="h-5" fill="none" xmlns="http://www.w3.org/2000/svg"><g
                    id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round"
                                                                   stroke-linejoin="round"></g><g
                    id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd"
                                                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM10.6935 15.8458L15.4137 13.059C16.1954 12.5974 16.1954 11.4026 15.4137 10.941L10.6935 8.15419C9.93371 7.70561 9 8.28947 9 9.21316V14.7868C9 15.7105 9.93371 16.2944 10.6935 15.8458Z"
                                                    fill="#a6acba"></path> </g></svg>
              </a>
              <a class="inline-block align-text-top"
                 :href="translated_subtitle_url">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5" viewBox="0 0 24 24"
                     fill="none">
                  <g id="SVGRepo_bgCarrier" stroke-width="0"/>
                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
                  <g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd"
                                                     d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12ZM12 6.25C12.4142 6.25 12.75 6.58579 12.75 7V12.1893L14.4697 10.4697C14.7626 10.1768 15.2374 10.1768 15.5303 10.4697C15.8232 10.7626 15.8232 11.2374 15.5303 11.5303L12.5303 14.5303C12.3897 14.671 12.1989 14.75 12 14.75C11.8011 14.75 11.6103 14.671 11.4697 14.5303L8.46967 11.5303C8.17678 11.2374 8.17678 10.7626 8.46967 10.4697C8.76256 10.1768 9.23744 10.1768 9.53033 10.4697L11.25 12.1893V7C11.25 6.58579 11.5858 6.25 12 6.25ZM8 16.25C7.58579 16.25 7.25 16.5858 7.25 17C7.25 17.4142 7.58579 17.75 8 17.75H16C16.4142 17.75 16.75 17.4142 16.75 17C16.75 16.5858 16.4142 16.25 16 16.25H8Z"
                                                     fill="#a6acba"/> </g>
                </svg>
            </a>
            </span>
            <span v-else-if="task.translate_status === 'failed'">翻译未完成。</span>
            <span>（翻译引擎：{{ task.translate_engine }}）</span>
          </span>
        </div>

        <div class="bg-base-100 rounded-xl shadow-md overflow-hidden p-4 m-1 relative" v-if="success||error">
          <button class="btn btn-square btn-sm absolute right-2 top-2" @click="copy">
            <svg class="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 32 32">
              <path
                  d="M 16 3 C 14.742188 3 13.847656 3.890625 13.40625 5 L 6 5 L 6 28 L 26 28 L 26 5 L 18.59375 5 C 18.152344 3.890625 17.257813 3 16 3 Z M 16 5 C 16.554688 5 17 5.445313 17 6 L 17 7 L 20 7 L 20 9 L 12 9 L 12 7 L 15 7 L 15 6 C 15 5.445313 15.445313 5 16 5 Z M 8 7 L 10 7 L 10 11 L 22 11 L 22 7 L 24 7 L 24 26 L 8 26 Z"></path>
            </svg>
          </button>
          <!--          <p class="text-sm mb-1 font-bold">如有需要可复制或截图以下信息，前往<a class="link">该帖子</a>回复获取帮助。</p>-->
          <div class="text-xs overflow-auto" id="task_info">
            <p v-if="task.url">URL: <a class="link" :href="task.url">{{ task.url }}</a></p>
            <p v-if="task.id">ID: {{ task.id }}</p>
            <p v-if="task.message&&error">Error: {{ task.message }}</p>
            <p v-if="task.create_time">创建时间: {{ task.create_time }}</p>
          </div>
        </div>
        <div class="justify-end card-actions" v-if="error && task.url">
          <button class="btn btn-primary mt-2" id="restart" @click="restart">
            重试
          </button>
        </div>
        <div class="justify-end card-actions" v-if="processing && task.id">
          <button class="btn btn-primary mt-2" id="refresh" @click="refresh(task.id)">
            刷新
          </button>
        </div>
      </div>
    </div>
  </dialog>
  <dialog id="info" class="modal" @close="closeInfo">
    <div class="modal-box flex flex-col max-h-[80vh]">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </form>
      <h2 class="font-bold text-2xl">关于</h2>
      <div class="overflow-y-auto px-4 py-2">
        <h3 class="font-bold text-lg py-2">源代码</h3>
        <p>网页：<a class="link" href="https://github.com/AChangAZha/translation-gummy-page">AChangAZha/translation-gummy-page</a>
        </p>
        <p>API：<a class="link" href="https://github.com/AChangAZha/translation-gummy">AChangAZha/translation-gummy</a>
        </p>
        <!--        <h3 class="font-bold text-lg py-2">联系</h3>-->
        <!--        <p>百度贴吧：<a class="link" href="https://example.com">example.com</a></p>-->
        <h3 class="font-bold text-lg py-2">致谢</h3>
        <p><a class="link" href="https://github.com/openai/whisper">OpenAI/Whisper</a></p>
        <p><a class="link" href="https://huggingface.co/spaces/aadnk/whisper-webui">aadnk/whisper-webui</a></p>
        <p><a class="link" href="https://github.com/vitalets/google-translate-api">vitalets/google-translate-api</a></p>
        <p><a class="link" href="https://github.com/machinewrapped/gpt-subtrans">machinewrapped/gpt-subtrans</a></p>
        <p><a class="link" href="https://github.com/Kaggle/kaggle-api">Kaggle/kaggle-api</a></p>
        <p><a class="link" href="https://github.com/coleifer/peewee">coleifer/peewee</a></p>
        <p><a class="link" href="https://github.com/cdown/srt">cdown/srt</a></p>
        <p><a class="link" href="https://github.com/psf/requests">psf/requests</a></p>
        <p><a class="link" href="https://github.com/saadeghi/daisyui">saadeghi/daisyui</a></p>
        <p><a class="link" href="https://github.com/tailwindlabs/tailwindcss">tailwindlabs/tailwindcss</a></p>
        <p><a class="link" href="https://github.com/zhw2590582/ArtPlayer">zhw2590582/ArtPlayer</a></p>
        <p><a class="link" href="https://github.com/vitejs/vite">vitejs/vite</a></p>
        <p><a class="link" href="https://github.com/vuejs/vue">vuejs/vue</a></p>
        <p><a class="link" href="https://github.com/axios/axios">axios/axios</a></p>
        <h3 class="font-bold text-lg py-2">声明</h3>
        <p>本网站仅供学习交流使用，请勿滥用。</p>
        <p>本网站不保证服务的稳定性，如有问题可联系开发者。</p>
        <h3 class="font-bold text-lg py-2">设置</h3>
        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Kaggle username</span>
          </label>
          <input type="text" placeholder="Kaggle username" class="input input-bordered w-full max-w-xs"
                 v-model="kaggleUsername"/>
        </div>
        <div class="form-control w-full max-w-xs">
          <label class="label">
            <span class="label-text">Kaggle API key</span>
          </label>
          <input type="text" placeholder="Kaggle API key" class="input input-bordered w-full max-w-xs"
                 v-model="kaggleKey"/>
        </div>
        <!--        <div class="form-control w-full max-w-xs">-->
        <!--          <label class="label">-->
        <!--            <span class="label-text">OpenAI API key</span>-->
        <!--          </label>-->
        <!--          <input type="text" placeholder="OpenAI API key" class="input input-bordered w-full max-w-xs"-->
        <!--                 v-model="openAIKey"/>-->
        <!--        </div>-->
      </div>
    </div>
  </dialog>
  <dialog id="recent" class="modal">
    <div class="modal-box flex flex-col max-h-[80vh]">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </form>
      <h2 class="font-bold text-2xl">最近任务</h2>
      <div class="overflow-y-auto px-4 mb-4" v-if="taskCacheList.length !== 0">
        <table class="table text-xs">
          <!-- head -->
          <thead>
          <tr>
            <th></th>
            <th>URL</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
          </thead>
          <tbody>
          <!-- row 1 -->
          <tr v-for="item in taskCacheList" :key="item.id">
            <th>
              <div class="w-24 break-words">{{ item.id }}</div>
            </th>
            <td>
              <div class="w-20 text-ellipsis overflow-hidden">
                <a class="link" :href="item.url">{{ item.url }}</a>
              </div>
            </td>
            <td>
              <div class="w-16 break-words">
                {{ item.update_time }}
              </div>
            </td>
            <td>
              <div class="w-11">
                <button class="btn btn-xs btn-primary" @click="queryTask(item.id)">
                  查询
                </button>
              </div>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
      <div class="alert mt-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>如需查询历史任务，需提供任务编号。或前往<a class="link" href="https://dora.starh.top/subtitles">该页面</a>查找。
        </span>
      </div>
      <div class="join mt-4 mx-auto w-auto">
        <input class="input w-96 max-w-2xl input-bordered join-item" placeholder="任务编号" v-model="inputTaskId">
        <button class="btn join-item" @click="queryTask(inputTaskId)">
          查询
        </button>
      </div>
    </div>
  </dialog>
  <dialog id="player" class="modal" @close="playerOpen = false">
    <div class="modal-box max-w-4xl">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </form>
      <h3 class="font-bold text-lg">预览</h3>
      <Artplayer v-if="playerOpen" @get-instance="getInstance" :option="option"
                 class="aspect-video w-full my-2"/>
    </div>
  </dialog>
</template>

<style scoped></style>
