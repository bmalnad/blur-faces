'use strict';
const AWS = require('aws-sdk');
const Jimp = require('jimp');

module.exports.blurfaces = (event, context, callback) => {  
  let rekognition = new AWS.Rekognition();
  let inputs = JSON.parse(event.body);
  
  /* pixelationSize determines the size of pixels used to pixelate a face. 
      - default is 7% of face height (0.07)
      - lower numbers may result in a pixelated face that is still recognizable 
      - higher numbers result in 
  */
  let pixelationSize = typeof inputs.pixelationSize == 'undefined' ? 0.07 : inputs.pixelationSize;
  let blurAdults = typeof inputs.blurAdults == 'undefined' ? true : inputs.blurAdults;
  let b64image = inputs.image.split(','); //inputs.image should be a base64 encoded image data url
  let imageBuffer = Buffer.from(b64image[1], 'base64');
  let rekognitionParams = {
    Image: {
      'Bytes': imageBuffer,
    }, 
    Attributes: [
      'ALL',
    ]
  };

  rekognition.detectFaces(rekognitionParams, function(err, faces) {
    if(err){
      let response = {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin' : '*', // Required for CORS support to work
        },
        body: JSON.stringify({
          err: err,
        }),
      };
      callback(null, response); 
    }else{
      Jimp.read(imageBuffer).then(function (image) {
        faces.FaceDetails.forEach((face, index) => {
          let bitmap = image.bitmap;
          let facebox = faces.FaceDetails[index].BoundingBox;

          //blur kid faces always. blur adults if parameter passed in 
          if(faces.FaceDetails[index].AgeRange.Low <= 18 || blurAdults == 'true'){
            let faceTop = bitmap.height * facebox.Top;
            let faceLeft = bitmap.width * facebox.Left;
            let faceHeight = bitmap.height * facebox.Height;
            let faceWidth = bitmap.width * facebox.Width;
            image.pixelate(Math.floor(faceHeight * pixelationSize),faceLeft,faceTop,faceWidth,faceHeight); 
          }
        });
        image.getBase64(image.getMIME(), function(err, img){
          let response = {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin' : '*', // Required for CORS support to work
              'Content-Type' : 'application/json',
            },
            body: JSON.stringify({
              blurAdults: inputs.blurAdults,
              pixelationSize: Math.floor(pixelationSize * 100) + '% of face height',
              facedata: faces,
              image: img,
            }),
          };
          callback(null, response);  
        });  
        
      }).catch(function(err){
        let response = {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin' : '*', 
            'Content-Type' : 'application/json',
          },
          body: JSON.stringify({
            err: err,
          }),
        };
        callback(null, response); 
      });
    }
  });
};