var express = require('express');
var router = express.Router();
var multiparty = require('multiparty');

let filePath = process.env.UPLOAD_FILE_PATH
const fs = require('fs');
const { resolve } = require('path');
const { rejects } = require('assert');
/* GET home page. */
router.get('/', function (req, res, next) {
  res.send('index');
});
router.post('/upload/exist', function (req, res, next) {
  let chunkName = req.body.chunkName
  new Promise((resolve, rejects) => {
    // console.log(chunkName);
    let chunkPath = ''
    // console.log(chunkName.indexOf("."));
    if (chunkName.indexOf('.') !== -1) {
      chunkPath = chunkName.substring(0, chunkName.indexOf('.')) + '/' + chunkName
    } else {
      chunkPath = chunkName.substring(0, chunkName.indexOf('_')) + '/' + chunkName
    }

    fs.open('./public/upload/' + chunkPath, 'r+', function (err, fd) {
      // console.log(err);
      if (err) {
        rejects()
        return
      }
      resolve()
    })
  }).then(resq => {
    // console.log('123');
    res.json({
      state: 1,
      data: true
    })
  }).catch(err => {
    res.json({
      state: 0,
      data: false
    })
  })

});

router.post('/upload', function (req, res, next) {
  let form = new multiparty.Form()
  // let readStream, writeStream
  // res.json({
  //   state:1,
  //   data:true
  // })

  // let msg = {}
  // 设置编辑
  // form.encoding = 'utf-8'
  //设置文件存储路劲
  form.uploadDir = 'F:/file'
  //设置文件大小限制
  // form.maxFilesSize = 2 * 1024 * 1024;
  form.parse(req, function (err, fields, files) {
    let fileName = fields.fileName[0]

    fs.exists('./public/upload', flg => {

      new Promise((resolve, rejects) => {
        if (!flg) {
          fs.mkdir('./public/upload', err => {
            resolve()
          })
        }
        resolve()
      }).then(resq => {
        return new Promise((resolve, rejects) => {
          fs.exists('./public/upload/' + fileName.substring(0, fileName.indexOf('_')), err => {
            if (!err) {
              fs.mkdir('./public/upload/' + fileName.substring(0, fileName.indexOf('_')), err => {
                resolve()
              })
            }
            resolve()
          })
        })
          .then(resq => {
            try {
              fs.writeFile('./public/upload/' + fileName.substring(0, fileName.indexOf('_')) + '/' + fileName, '', err => {
                fs.readFile(files.chunk[0].path, (err, data) => {
                  fs.writeFile('./public/upload/' + fileName.substring(0, fileName.indexOf('_')) + '/' + fileName, data, err => {
                    if (err) {
                      return res.json({ state: 0, data: false })
                    }
                    return res.json({ state: 1, data: true })
                  })
                })
              })
            } catch (error) {
              console.log(error);
            }
          })
      })
    })
  })
});
router.post('/upload/merge', function (req, res, next) {
  // console.log(req.body);
  let { chunkName, chunksLength, chunkType } = req.body
  fs.exists('./public/upload/' + chunkName, err => {
    if (err) {
      let currentWriteFilePath = './public/upload/' + chunkName + '/' + req.body.chunkName + '.' + chunkType
      let out = fs.createWriteStream(currentWriteFilePath);
      fs.writeFile(currentWriteFilePath, '', async err => {
        if (!err) {
          let i = 0;
          function main () {
            if (i > chunksLength) {
              out.end('enDD')
              return
            }
            let currentReadFilePath = './public/upload/' + chunkName + '/' + chunkName + '_' + i
            let file = fs.createReadStream(currentReadFilePath);
            file.pipe(out, { end: false })
            file.on('end', err => {
              fs.unlink(currentReadFilePath, err => {
                console.log('合并文件' +chunkName+'__'+ i);
                i++
                main()
              })

            })
          }
          main()
          res.json({
            state: 1,
            data: true
          })
        }
      })
    }
  })
})
module.exports = router;
