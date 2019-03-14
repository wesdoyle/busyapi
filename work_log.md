# Work Log

__Task__: Make the call POST `/api/usages` scale to 1M users per minute

`5:36 PM`: When I'm thinking about scaling an API, I want to minimize client response time and
maximize resource efficiency on the server side.

Before I start making any changes to the existing code, I'll set up some basic local load testing
and metric collection to see initial performance of the API in its current state.

- I have `k6` installed (`brew install k6 on osx`), so I'll create a quick load testing script in a new directory.



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
