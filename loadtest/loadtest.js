import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

const ENDPOINT = "http://host.docker.internal:3000/api/usages"

let failRate = new Rate("check_failure_rate");

// Spec some options for k6 to run and report
export let options = {
    rps: 16700, // (~1M rpm) note k6 on my machine won't hit this
    duration: '30s',
    thresholds : {
        "http_req_duration": ["p(95)<100"], // 95th percentile all http request durations < 100ms
        "check_failure_rate": [
            "rate<0.01", // global failure rates should be less than 1%
            { threshold: "rate<=0.05", abortOnFail: true },
        ]
    }
}

// run k6
export default function() {
    var payload = JSON.stringify({"patientId":"100","timestamp":"Tue Nov 01 2016 09:11:51 GMT-0500 (CDT)","medication":"Albuterol"});
    var params =  { headers: { "Content-Type": "application/json" } }
    let response = http.post(ENDPOINT, payload, params);
    let checkRes = check(response, {
        "status is 201": (r) => r.status === 201
    });

    failRate.add(!checkRes);
};
