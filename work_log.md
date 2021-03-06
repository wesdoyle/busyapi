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
I'm going to try and see if the package `loadtest` can deliver more rps.

> `loadtest http://localhost:3000/api/usages -T "application/json" -P '{"patientId":"100","timestamp":"Tue Nov 01 2016 09:11:51 GMT-0500 (CDT)","medication":"Albuterol"}' --rps 16700`

- `6:07 PM`: Loadtest does eventually start to cause problems for our API.  From the loadtest output, we see mean latency start to climb, and eventually the express server becomes pretty unresponsive.
It's also saturating my CPU. These monitoring results are somewhat invalid - we'd want the target application to be independent from the load testing machines in a true setup.

```
[Thu Mar 14 2019 18:05:45 GMT-0500 (Central Daylight Time)] INFO Requests: 0, requests per second: 0, mean latency: 0 ms
[Thu Mar 14 2019 18:05:50 GMT-0500 (Central Daylight Time)] INFO Requests: 5069, requests per second: 1015, mean latency: 214.9 ms
[Thu Mar 14 2019 18:05:55 GMT-0500 (Central Daylight Time)] INFO Requests: 10633, requests per second: 1113, mean latency: 2093.2 ms
[Thu Mar 14 2019 18:06:00 GMT-0500 (Central Daylight Time)] INFO Requests: 15374, requests per second: 949, mean latency: 4557.7 ms
[Thu Mar 14 2019 18:06:05 GMT-0500 (Central Daylight Time)] INFO Requests: 17889, requests per second: 484, mean latency: 6689.3 ms
[Thu Mar 14 2019 18:06:10 GMT-0500 (Central Daylight Time)] INFO Requests: 19776, requests per second: 365, mean latency: 8791.3 ms
[Thu Mar 14 2019 18:06:15 GMT-0500 (Central Daylight Time)] INFO Requests: 21643, requests per second: 380, mean latency: 12105.5 ms
[Thu Mar 14 2019 18:06:15 GMT-0500 (Central Daylight Time)] INFO Errors: 8, accumulated errors: 8, 0% of total requests
[Thu Mar 14 2019 18:06:20 GMT-0500 (Central Daylight Time)] INFO Requests: 23894, requests per second: 477, mean latency: 15629.3 ms
[Thu Mar 14 2019 18:06:20 GMT-0500 (Central Daylight Time)] INFO Errors: 0, accumulated errors: 8, 0% of total requests
[Thu Mar 14 2019 18:06:25 GMT-0500 (Central Daylight Time)] INFO Requests: 27719, requests per second: 763, mean latency: 18283.9 ms
[Thu Mar 14 2019 18:06:25 GMT-0500 (Central Daylight Time)] INFO Errors: 74, accumulated errors: 82, 0.3% of total requests
[Thu Mar 14 2019 18:06:30 GMT-0500 (Central Daylight Time)] INFO Requests: 29371, requests per second: 309, mean latency: 20696.8 ms
[Thu Mar 14 2019 18:06:30 GMT-0500 (Central Daylight Time)] INFO Errors: 1472, accumulated errors: 1554, 5.3% of total requests
[Thu Mar 14 2019 18:06:54 GMT-0500 (Central Daylight Time)] INFO Requests: 44551, requests per second: 636, mean latency: 32692.4 ms
[Thu Mar 14 2019 18:06:54 GMT-0500 (Central Daylight Time)] INFO Errors: 15180, accumulated errors: 16734, 37.6% of total requests
[Thu Mar 14 2019 18:06:56 GMT-0500 (Central Daylight Time)] INFO Requests: 47038, requests per second: 1189, mean latency: 50070.6 ms
```

- `6:12`: I'm going to start looking through the app for any low-hanging simple optimizations.

- `6:20`: The first few things I notice on the usages route:
    - We're just pushing a new `usageId` onto an array.  Clearly we'd implement some type of persistent storage here to
      store data received from the request.  If the goal is to capture lots of reads very quickly, we could use document
      storage / NoSQL like MongoDB or Cassandra for this purpose.

    - We're logging to the console here, which doesn't make much sense in terms of performance for production, so I've removed it.

    - If I have some time, I'll come back and replace the in-memory array with a mongodb client like `mongoose`

- `6:35`: Looking at the Express server setup, I see a few minor changes we can make to try and tune performance a bit.
    - We can use gzip compression. The `compression` middleware will attempt to compress all response bodies for requests.
      This might give us a bigger gain in other use cases, where response body size is more significant.

- `7:00`: I'm now thinking about implementing some kind of basic service management so that we can run multiple instances of the app to provide concurrency.
We wouldn't want to depend on a single instance of an app in production to handle tens of thousands of rps. I've heard of using PM2 for this, so I'm going
to try and set up something simple as a proof-of-concept.

- `7:10`: Running 8 instances of the api with bare-bones PM2 was a bit easier than expected:

  - `pm2 start bin/www -i max`

  > Starting the app using max number of CPUs

```
  [PM2] Spawning PM2 daemon with pm2_home=/Users/wes/.pmyapi [master] ⚡  pm2 start bin/www -i max
  [PM2] Starting /Users/wes/projects/busyapi/bin/www in cluster_mode (0 instance)
  [PM2] Done.
  ┌──────────┬────┬─────────┬─────────┬───────┬────────┬─────────┬────────┬─────┬───────────┬──────┬──────────┐
  │ App name │ id │ version │ mode    │ pid   │ status │ restart │ uptime │ cpu │ mem       │ user │ watching │
  ├──────────┼────┼─────────┼─────────┼───────┼────────┼─────────┼────────┼─────┼───────────┼──────┼──────────┤
  │ www      │ 0  │ 0.0.0   │ cluster │ 79119 │ online │ 0       │ 0s     │ 0%  │ 46.0 MB   │ wes  │ disabled │
  │ www      │ 1  │ 0.0.0   │ cluster │ 79120 │ online │ 0       │ 0s     │ 0%  │ 45.7 MB   │ wes  │ disabled │
  │ www      │ 2  │ 0.0.0   │ cluster │ 79127 │ online │ 0       │ 0s     │ 0%  │ 45.6 MB   │ wes  │ disabled │
  │ www      │ 3  │ 0.0.0   │ cluster │ 79132 │ online │ 0       │ 0s     │ 0%  │ 45.7 MB   │ wes  │ disabled │
  │ www      │ 4  │ 0.0.0   │ cluster │ 79137 │ online │ 0       │ 0s     │ 0%  │ 41.6 MB   │ wes  │ disabled │
  │ www      │ 5  │ 0.0.0   │ cluster │ 79142 │ online │ 0       │ 0s     │ 0%  │ 38.4 MB   │ wes  │ disabled │
  │ www      │ 6  │ 0.0.0   │ cluster │ 79147 │ online │ 0       │ 0s     │ 0%  │ 29.0 MB   │ wes  │ disabled │
  │ www      │ 7  │ 0.0.0   │ cluster │ 79152 │ online │ 0       │ 0s     │ 0%  │ 20.8 MB   │ wes  │ disabled │
  └──────────┴────┴─────────┴─────────┴───────┴────────┴─────────┴────────┴─────┴───────────┴──────┴──────────┘
```

  - It looks like PM2 also lets us monitor the instances from the terminal.
  - `pm2 monit` shows the requests coming in as I run the `k6` tests.

- `7:30`: As I'm up against the time limit here, I'll describe a few thoughts about next steps.  The High-level notes below were written at the beginning of the project.

  - Use a client like `mongoose` for data persistence in mongodb.  We can use a unique identifier for each saved object instead of `Array.length`
  - Use HTTP/2 - looking at the inspector, we're using 1.1.  HTTP/2 supports multiple concurrent requests on a single TCP connection.
  - Add Load balancer
  - Cluster the web API - create a worker for each CPU (and possibly fork() when one dies)
  - Set up an appropriate separate monitoring system with the app running on a production server
  - Set up load testing machine(s) to deliver the 1M rpm in a stable manner
  - Aggregate structured production logs



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
