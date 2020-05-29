
$(function () {
  const config = {
    fileIcon: './images/upload.png',
    selectIcon: './images/videoFile.png'
  }

  //单个切片长度
  const LENGTH = 1024 * 1024 * 2
  //是否有上传任务
  let taskSync = false
  //输入框
  let fileInput = $('#file-input').get(0)
  //上传文件盒子
  let uploadBox = $('.upload-box').get(0)
  //文件图标
  let iconImg = $('.icon>img').get(0)
  //提示信息
  let msg = $('.desc').get(0)
  //上传按钮组
  let uploadBtn = $('.btn')

  let p
  //清除浏览器默认行为
  clearDefaultBehavior()
  //绑定按钮点击事件
  uploadBox.onclick = (e) => {
    fileInput.click()
  }
  uploadBox.ondrop = (e) => {
    // console.log(e.target);
    inputListiner(e)
  }
  //处理文件选择（拖拽或点击）
  fileInput.oninput = inputListiner
  //input监听事件
  function inputListiner (e) {
    if (!taskSync) {
      //任务置忙
      obtainFileList(e)
      return
    }
    alert('有一个问正在上传')
  }
  //处理选中文件列表
  function obtainFileList (e) {
    // console.log('input' + e.target);

    //声明文件列表
    let files = [];
    //判断对象
    if (e.target instanceof HTMLInputElement) {
      //input选择对象
      files = e.target.files
    } else {
      //拖拽对象
      files = e.dataTransfer.files
    }
    if (files.length <= 0) {
      //还原视图      
      updataView()
      return
    }
    
    // let readF = new FileReader
    // readF.onload = e => {
    //   $('.video').attr('src', e.target.result)
    // }
    // readF.readAsDataURL(files[0])
    // console.log(files[0]);

    //拿到文件列表
    // console.log(files);
    //更新视图操作    
    updataView(files)
    //监听取消文件按钮
    $(uploadBtn).children().get(1).onclick = function () {
      console.log(123);
      $(fileInput).val('')
      updataView()
    }
    //监听点击上传文件按钮
    $(uploadBtn).children().get(0).onclick = async function uploadBtnEventListener () {

      if (taskSync) {
        alert('正在上传')
        return
      }
      taskSync = true

      //循环获取各个文件md5
      for (let i = 0; i < files.length; i++) {
        //文件顺序切片顺序上传即处理完第一个文件在处理第二个文件
        let fileObj = await getFileMD5(files[i])//读取文件md5和对文件切片
        //获取成功失败回调
        console.log(fileObj);
        let isExit = await fileExit(fileObj.hash + (fileObj.type ? '.' + fileObj.type : ''))//文件名hash.type
        if (isExit) {
          $('.uploadProgress').text('100%')
          $('.progressfile').get(0).style.setProperty('--progress', '100%')
          //视图更新          
          //存在文件则直接跳过
          continue
        }
        let isLoadEnd = await uploadFileSync(fileObj)
        if (isLoadEnd) {

          //视图更新         
          //上传完成发送合并文件请求
          mergeFile(fileObj)
            .then(res => {
              $('.progressfile').get(0).style.setProperty('--progress', '100%')
              $('.uploadProgress').text('100%')
              //视图更新              
              updataView()
              taskSync = false
            })
        }
      }
      taskSync = false
      // sendPostFile(uploadTask)
    }
  }


  function fileExit (name) {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: 'POST',
        url: '/upload/exist',
        timeout: 5000,
        data: {
          chunkName: name
        },
        success (res) {
          resolve(res.data)
        },
        error () {
          console.log('服务器错误')
        }
      })
    })
      .then(res => {
        return res
      })
      .catch(err => {
        console.log('发送错误');

      })

  }
  function sendChunk (fileName, chunk) {

    let formdata = new FormData
    formdata.append('fileName', fileName)
    formdata.append('chunk', chunk)
    return new Promise((resolve, reject) => {
      $.ajax({
        type: 'POST',
        url: '/upload',
        dataType: 'json',
        data: formdata,
        // timeout: 50000,
        processData: false, // 使数据不做处理
        contentType: false,
        success (res) {
          resolve(res.data)
        }, error () {
          console.log('失败');
          resolve(false)
        }
      })
    }).then(res => {
      return res ? true : false
    }).catch(err => {
      return err ? true : false
    })

  }
  async function uploadFileSync (task) {
    return new Promise(async (resolve, reject) => {
      for (var i = 0; i < task.chunks.length; i++) {
        //判断是否存在切片(做断点续传)
        let chunkName = task.hash + '_' + i
        let isExit = await fileExit(chunkName)
        if (isExit) {
          continue
        }
        //发送切片
        let result = await sendChunk(chunkName, task.chunks[i])
        //判断文件是否上传成功
        if (result) {
          //视图更新
          $('.uploadProgress').text(parseFloat(i / task.chunks.length * 100).toFixed(2) + '%')
          $('.progressfile').get(0).style.setProperty('--progress', parseFloat(i / task.chunks.length * 100).toFixed(2) + '%')

          console.log(chunkName + '上传成功');
        } else {
          console.log(chunkName + '上传失败');
        }
      }
      resolve(true)
    })
      .then(res => {
        return res
      })

  }

  function mergeFile (task) {
    console.log("merge:" + task.chunks.length + task.hash + task.type);

    return new Promise((resolve, reject) => {
      // 合并文件请求文件hash名，切片长度，后缀名
      $.ajax({
        type: 'POST',
        url: '/upload/merge',
        timeout: 5000,
        data: {
          chunkName: task.hash,
          chunksLength: task.chunks.length - 1,
          chunkType: task.type,
        },
        success (res) {
          resolve(res.data)
        },
        error (err) {
          reject(err)
          console.log('服务器错误')
        }
      })
    })
  }

  function getFileMD5 (file) {
    return new Promise((resolve, reject) => {
      let readFile = new FileReader()
      //创建SparkMD5对象
      let md5 = new SparkMD5.ArrayBuffer()
      //获取文件切片
      // let chunks = getFileChunks(file)
      //切片数组
      let chunks = []
      //切片起始位置结束为止
      let start = 0, end = start + LENGTH
      //循环将文件切为2m大小
      while (end < file.size + LENGTH) {
        console.log(end / file.size * 100 + '%');
        chunks.push(file.slice(start, end))
        start = end
        end = start + LENGTH
      }
      if (chunks.length <= 0) reject('文件不合法')
      let num = 0;
      //文件读取结果监听
      readFile.onload = e => {
        // console.log(num, chunks.length);
        //解析
        md5.append(e.target.result)
        if (num < chunks.length) {
          loadFile(chunks[num++])
        } else {
          //md5计算完成
          let hash = md5.end()
          console.log(hash);
          //返回整理文件上传集包含（文件，文件hash，文件切片文件，文件名后缀,可后期添加处理）
          resolve({
            file,
            hash,
            chunks,
            type: file.name.indexOf('.') === -1 ? '' : file.name.substring(file.name.indexOf('.') + 1, file.name.length)
          })
        }
      }
      //读取文件方法
      function loadFile (file) {
        $('.spreak').text(parseInt(num / chunks.length * 100) + '%')
        $('.progressmd5').get(0).style.setProperty('--progress', parseInt(num / chunks.length * 100) + '%')
        // console.log();
        //视图更新
        readFile.readAsArrayBuffer(file)
      }
      //文件切片（耗时）也可使用es6 webWork（暂不实现）
      function getFileChunks (file) {

      }

      //初次读取
      loadFile(chunks[num++])
    }).then(res => {
      return res
    })


  }
  //清除浏览器默认行为并控制文件选择效果
  function clearDefaultBehavior () {
    window.ondragover = window.ondragenter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      // console.log('进入斌移动');
      $(uploadBox).addClass('animate')
    }
    window.ondrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      // console.log('松开');
      $(uploadBox).removeClass('animate')
    }
  }
  //更新状态
  function updataView (files) {
    if (!files) {
      $(iconImg).attr('src', config.fileIcon)
      $(uploadBtn).removeClass('hidden')
      // console.log(name);
      let name = '点击或拖拽文件到内容区域'
      $(uploadBtn).addClass('hidden')
      $(msg).html(name)
      $('.uploadProgress').text('0%')
      $('.spreak').text(0 + '%')
      // $('.progressmd5').get(0).style.setProperty('--progress', 0 + '%')
      return
    }

    $(iconImg).attr('src', config.selectIcon)
    let name = ''
    for (let i = 0; i < files.length; i++) {
      name += files[i].name + '<br/>'
    }
    $(uploadBtn).removeClass('hidden')
    // console.log(name);
    $('.progressmd5').get(0).style.setProperty('--progress', 0 + '%')
    $('.progressfile').get(0).style.setProperty('--progress', 0 + '%')
    $(msg).html(name)
  }
})

