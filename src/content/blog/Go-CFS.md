---
title: 'Go, Containers, and the Linux Scheduler'
description: 'How to make the Go runtime play nicely with the Linux Scheduler'
pubDate: 'Nov 04 2023'
heroImage: '/Gopher.jpg'
---

Like many Go developers my applications are usually deployed in containers.
When running in container orchestrators it's important to set CPU limits to ensure that the container doesn't consume all the CPU on the host.
However, the Go runtime is not aware of the CPU limits set on the container and will happily use all the CPU available.
This has bitten me in the past, leading to high latency, in this blog I'll explain what is going on and how to fix it.

## How the Go Garbage Collector works

This is going to be a pretty high level overview of the Go Garbage Collector (GC).
For a more in depth overview I recommend reading [the go docs](https://tip.golang.org/doc/gc-guide)
and this [excellent series of blogs](https://www.ardanlabs.com/blog/2018/12/garbage-collection-in-go-part1-semantics.html)
by Will Kennedy.

The vast majority of the time the Go runtime performs garbage collection concurrently with the execution of your program.
This means that the GC is running at the same time as your program. However, there are two points in the GC process where the Go runtime needs to stop every Goroutine.
This is required to ensure data integrity. Before the Mark Phase of the GC the runtime stops every Goroutine to apply the write barrier, this ensures no objects created after this point are garbage collected. This phase is known as Sweep Termination.
After the mark phase has finished there is another stop the world phase, this is known as Mark Termination and the same process happens to remove the write barrier. These usually takes in the order of tens of microseconds.

I created a simple web application that allocates a lot of memory and ran it in a container with a limit of 4 CPU cores with the following command.The Source code for this is available [here.](https://github.com/RiverPhillips/go-cfs-blog)

```bash
docker run -p 8080:8080 $(ko build -L main.go) --cpus=4
```

You can collect a trace using the [runtime/trace](https://golang.org/pkg/runtime/trace/) package then analyze it with `go tool trace`. The following trace shows a GC cycle captured on my machine. You can see the Sweep Termination and the Mark Termination stop the world phase on `Proc 5` (They're labelled STW for stop the world).

[![GC Trace](/gc_trace.jpg)](/gc_trace.jpg)

This GC cycle took just under 2.5ms, but we spent almost 10% of that in a stop the world phase. This is a pretty significant amount of time, especially if you are running a latency sensitive application.

## The Linux Scheduler

The [Completely Fair Scheduler (CFS)](https://docs.kernel.org/scheduler/sched-design-CFS.html) was introduced in Linux 2.6.23 and was the default Scheduler until Linux 6.6 which was released last week. It's likely you're using the CFS.

The CFS is a [proportional share scheduler](https://en.wikipedia.org/wiki/Proportional_share_scheduling), this means that the weight of a process is proportional to the number of CPU cores it is allowed to use. For example, if a process is allowed to use 4 CPU cores it will have a weight of 4. If a process is allowed to use 2 CPU cores it will have a weight of 2.

The CFS does this by allocating a fraction of CPU time. A 4 core system has 4 seconds of CPU time to allocate every second. When you allocate a container a number of CPU cores you're essentially asking the Linux Scheduler to give it `n` CPUs worth of time.

In the above `docker run` command I'm asking for 4 CPUs worth of time. This means that the container will get 4 seconds of CPU time every second.

## The Problem

When the Go runtime starts it creates an OS thread for each CPU core. This means if you have a 16 core machine the Go runtime will create 16 OS threads - regardless of any CGroup CPU Limits. The Go runtime then uses these OS threads to schedule goroutines.

The problem is that the Go runtime is not aware of the CGroup CPU limits and will happily schedule goroutines on all 16 OS threads. This means that the Go runtime will expect to be able to use 16 seconds of CPU time every second.

Long stop the world durations arise from the Go runtime needing to stop Goroutine on threads that it's waiting for the Linux Scheduler to schedule. These threads will not be scheduled once the container has used it's CPU quota.

## The Solution

Go allows you to limit the number of CPU threads that the runtime will create using the `GOMAXPROCS` environment variable. Below is a trace captured from the same application as above but with `GOMAXPROCS` set to 4.

[![GC Trace](/gc_trace_4.jpg)](/gc_trace_4.jpg)

In this trace, the garbage collection is much shorter, despite having the exact same load. The GC Cycle took under 1ms and the stop the world phase was 26μs, approximately 1/10 of the time when there was no limit.

`GOMAXPROCS` should be set to the number of CPU cores that the container is allowed to use, if you're allocating fractional CPU round down, unless you're allocating less than 1 CPU core in which case round up. `GOMAXPROCS=max(1, floor(CPUs))` can be used to calculate the value.
If you find it easier Uber has open sourced a library [automaxprocs](https://github.com/uber-go/automaxprocs) to calculate this value for you from your container's cgroups automatically.

There's an outstanding [Github Issue](https://github.com/golang/go/issues/33803) with the Go runtime to support this out the box so hopefully it will be added eventually!

## Conclusion

When running Go in a containerised application it's important to set CPU limits. It's also important to ensure that the Go runtime is aware of these limits by setting a sensible `GOMAXPROCS` value or using a library like [automaxprocs](https://github.com/uber-go/automaxprocs).
