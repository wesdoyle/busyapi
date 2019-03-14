# Work Log

__Task__: Make the call POST `/api/usages` scale to 1M users per minute

- `5:36 PM`: When I'm thinking about scaling an API, I want to minimize client response time and
maximize resource efficiency on the server side.

- Before I start making any changes to the existing code, I'll set up some basic local load testing
and metric collection to see initial performance of the API in its current state.

- I have `k6` running locally in a Docker container, so I'll create a quick load testing script in a new directory.

- `6:01 PM`: I've got a basic k6 config setup and can execute a load test using a shell script that just uses a k6 Docker container
and tells it to look at the `loadtest.js` script, which defines some basic metrics and asserts we're getting `201` codes when we load up the server with POST requests.
Here's the report:

```
    ✓ status is 201

    time="2019-03-14T23:00:34Z" level=info msg="Test finished" i=8251 t=30.0016906s
    ✓ check_failure_rate.........: 0.00%   ✓ 0    ✗ 8251
    checks.....................: 100.00% ✓ 8251 ✗ 0
    data_received..............: 1.8 MB  61 kB/s
    data_sent..................: 2.1 MB  69 kB/s
    http_req_blocked...........: avg=72.53µs  min=28.6µs  med=61.4µs  max=2.7ms   p(90)=100.3µs p(95)=139µs
    http_req_connecting........: avg=85ns     min=0s      med=0s      max=704µs   p(90)=0s      p(95)=0s
    ✓ http_req_duration..........: avg=2.19ms   min=270.1µs med=1.89ms  max=45.61ms p(90)=3.29ms  p(95)=3.91ms
    http_req_receiving.........: avg=122.84µs min=26.1µs  med=106.1µs max=4.75ms  p(90)=195.4µs p(95)=246.6µs
    http_req_sending...........: avg=88.76µs  min=21.5µs  med=69.6µs  max=1.99ms  p(90)=146µs   p(95)=186.25µs
    http_req_tls_handshaking...: avg=0s       min=0s      med=0s      max=0s      p(90)=0s      p(95)=0s
    http_req_waiting...........: avg=1.98ms   min=0s      med=1.69ms  max=45.4ms  p(90)=3ms     p(95)=3.58ms
    http_reqs..................: 8251    275.017835/s
    iteration_duration.........: avg=3.52ms   min=1.35ms  med=3.12ms  max=89.94ms p(90)=4.95ms  p(95)=5.66ms
    iterations.................: 8251    275.017835/s
    vus........................: 1       min=1  max=1
    vus_max....................: 1       min=1  max=1
```

- Unfortunately, my laptop isn't going to be able to slam the API with 1M requests per minute, even though I've configured k6 to try and do so.
Our server is health, and 95th percentile `http_req_duration` is 3.91ms. Not bad, but we're still pretty far from handling our target number of requests.
I'm going to try and see if the package `load-test` can deliver more rps.

> `loadtest http://localhost:3000/api/usages -T "application/json" -P '{"patientId":"100","timestamp":"Tue Nov 01 2016 09:11:51 GMT-0500 (CDT)","medication":"Albuterol"}' --rps 16700`


### High-level thoughts about next-step implementations:

For monitoring, I'd consider open-source tools like Prometheus and Grafana as a first step,
as it is not difficult to get these types of tools set up and configured for our purposes. I think we'd want to identify and monitor the
"four golden signals" of traffic, latency, resource saturation, and error rates from our API.

To get a good idea of patterns of traffic, We'll want to study patterns of peak request rates against our API, understand what the baseline rate is, and design the architecture in such a
way that we can scale horizontally up to handle periods of high traffic, and potentially scale down as needed so we don't pay for more than what we need most of the time.

Since we're aiming to handle 1M rpm, in this example, we'll likely want to consider putting an API gateway and load balancer in place to sit between the client,
the reverse proxy, and our server.  We'll also want to observe data about the location of requests, so that we can provision servers in geographic regions that make
the most sense to reduce latency if necessary.

For scale testing a proof-of-concept, we can start with a simple local setup on a single machine using something like `k6` or `artillery`.
To simulate more realistic heavy loads, we'd want to consider deploying multiple machines and coordinating them for that purpose.

As we scale test, it will be useful to implement monitoring and logging into our app, since this is a significant amount of traffic.
We could do some basic monitoring with `top` locally and tools like express-status-monitor.  As the system becomes more distributed,
we'll have new failure modes to monitor, and we'll want to be able to get to root cause a quickly as possible. It will be important
to aggregate structured logs from instances of our service.
