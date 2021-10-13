var express = require('express');
var router = express.Router();
const fs     = require('fs');
const ziti   = require('ziti-sdk-nodejs');

const UV_EOF = -4095;

const zidFile        = './expressApp.json'
const zitiId         = process.env.ZITI_IDENTITY;
const serviceUrl    = process.env.SERVICE_URL;

if (zitiId === '') {
  console.log(`ZITI_IDENTITY env var was not specified`);
  process.exit(-1);
}
if (serviceUrl === '') {
  console.log(`SERRVICE_URL env var was not specified`);
  process.exit(-1);
}

// Write zitiId to file
fs.writeFileSync(zidFile, zitiId);

const zitiInit = async (zitiFile) => {
  return new Promise((resolve, reject) => {
    var rc = ziti.ziti_init(zitiFile, (init_rc) => {
        if (init_rc < 0) {
            return reject(`init_rc = ${init_rc}`);
        }
        return resolve();
    });

    if (rc < 0) {
        return reject(`rc = ${rc}`);
    }
  });
};

const zitiServiceAvailable = async (service) => {
  return new Promise((resolve, reject) => {
    ziti.ziti_service_available(service, (obj) => {
      if (obj.status != 0) {
        console.log(`service ${service} not available, status: ${status}`);
        return reject(status);
      } else {
        console.log(`service ${service} available`);
        return resolve();
      }
    });
  });
}

const zitiHttpRequest = async (url, method, headers) => {
  return new Promise((resolve) => {
    ziti.Ziti_http_request(
      url, 
      method,
      headers,
      (obj) => { // on_req callback
          console.log('on_req callback: req is: %o', obj.req);
          return resolve(obj.req);
      },        
      (obj) => { // on_resp callback
        console.log(`on_resp status: ${obj.code} ${obj.status}`);
        if (obj.code != 200) {
          core.setFailed(`on_resp failure: ${obj.status}`);
          process.exit(-1);
        }
        process.exit(0);
      },
      (obj) => { // on_resp_body callback
        // not expecting any body...
        if (obj.len === UV_EOF) {
          console.log('response complete')
          process.exit(0);
        } else if (obj.len < 0) {
          core.setFailed(`on_resp failure: ${obj.len}`);
          process.exit(-1);
        }

        if (obj.body) {
          let str = Buffer.from(obj.body).toString();
          console.log(`on_resp_body len: ${obj.len}, body: ${str}`);
        } else {
          console.log(`on_resp_body len: ${obj.len}`);
        }
      });
  });
};

const zitiHttpRequestData = async (req, buf) => {
  ziti.Ziti_http_request_data(
    req, 
    buf,
    (obj) => { // on_req_body callback
      if (obj.status < 0) {
          reject(obj.status);
      } else {
          resolve(obj);
      }
  });
};

/* GET home page. */
router.get('/', function(req, res, next) {
  console.log(req.body);
  console.log(res);
   // First make sure we can initialize Ziti
  await zitiInit(zidFile).catch((err) => {
    console.log(`zitiInit failed: ${err}`);
    process.exit(-1);
  });

  let serviceName = req.hostname;
  await zitiServiceAvailable(serviceName).catch((err) => {
    console.log(`zitiServiceAvailable failed: ${err}`);
    process.exit(-1);
  });

  let request = await zitiHttpRequest(serviceUrl, req.method, req.headers).catch((err) => {
    console.log(`zitiHttpRequest failed: ${err}`);
    process.exit(-1);
  });

  ziti.Ziti_http_request_end(request);

  res.render('index', { title: 'Express' });
  
});

module.exports = router;
