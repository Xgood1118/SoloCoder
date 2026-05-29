import logging
import threading
from datetime import datetime

import database as db
import fetcher

logger = logging.getLogger(__name__)

_default_interval = 30


class SyncScheduler:
    def __init__(self, db_path=None, user_agent=None):
        self.db_path = db_path
        self.user_agent = user_agent
        self._timers = {}
        self._lock = threading.Lock()
        self._running = False

    def start(self):
        self._running = True
        self._schedule_all()
        logger.info("Sync scheduler started")

    def stop(self):
        self._running = False
        with self._lock:
            for feed_id, timer in self._timers.items():
                timer.cancel()
            self._timers.clear()
        logger.info("Sync scheduler stopped")

    def _schedule_all(self):
        if not self._running:
            return
        try:
            feeds = db.get_active_feeds(self.db_path)
        except Exception as e:
            logger.error(f"Failed to get active feeds for scheduling: {e}")
            if self._running:
                timer = threading.Timer(60, self._schedule_all)
                timer.daemon = True
                timer.start()
            return

        current_feed_ids = {f["id"] for f in feeds}

        with self._lock:
            for fid in list(self._timers.keys()):
                if fid not in current_feed_ids:
                    self._timers[fid].cancel()
                    del self._timers[fid]

        for feed in feeds:
            feed_id = feed["id"]
            interval = feed.get("update_interval", _default_interval) or _default_interval
            with self._lock:
                if feed_id not in self._timers:
                    self._schedule_feed(feed_id, interval)

    def _schedule_feed(self, feed_id, interval_minutes):
        if not self._running:
            return
        timer = threading.Timer(interval_minutes * 60, self._run_sync, args=(feed_id,))
        timer.daemon = True
        self._timers[feed_id] = timer
        timer.start()

    def _run_sync(self, feed_id):
        try:
            feed = db.get_feed(feed_id, self.db_path)
            if feed is None:
                logger.warning(
                    f"Feed {feed_id} no longer exists in database, skipping sync and removing timer"
                )
                with self._lock:
                    self._timers.pop(feed_id, None)
                return

            if not feed.get("is_active"):
                logger.info(f"Feed {feed_id} is inactive, skipping sync")
                with self._lock:
                    self._timers.pop(feed_id, None)
                return

            logger.info(f"Syncing feed {feed_id}: {feed.get('title', feed['url'])}")
            result = fetcher.fetch_feed(feed_id, self.user_agent, self.db_path)
            logger.info(f"Feed {feed_id} sync result: {result}")

        except (KeyError, AttributeError) as e:
            logger.warning(
                f"Feed {feed_id} sync failed - feed may have been deleted or modified: {e}"
            )
        except Exception as e:
            logger.error(f"Unexpected error syncing feed {feed_id}: {e}")
        finally:
            with self._lock:
                self._timers.pop(feed_id, None)

            if self._running:
                try:
                    feed = db.get_feed(feed_id, self.db_path)
                    if feed and feed.get("is_active"):
                        interval = feed.get("update_interval", _default_interval) or _default_interval
                        self._schedule_feed(feed_id, interval)
                    else:
                        logger.info(
                            f"Feed {feed_id} not found or inactive, not rescheduling"
                        )
                except Exception as e:
                    logger.warning(
                        f"Failed to reschedule feed {feed_id}: {e}. Will retry in 60s"
                    )
                    if self._running:
                        retry_timer = threading.Timer(
                            60, self._reschedule_after_error, args=(feed_id,)
                        )
                        retry_timer.daemon = True
                        retry_timer.start()

    def _reschedule_after_error(self, feed_id):
        if not self._running:
            return
        try:
            feed = db.get_feed(feed_id, self.db_path)
            if feed and feed.get("is_active"):
                interval = feed.get("update_interval", _default_interval) or _default_interval
                self._schedule_feed(feed_id, interval)
        except Exception as e:
            logger.warning(f"Reschedule retry failed for feed {feed_id}: {e}")

    def trigger_sync(self, feed_id=None):
        if feed_id:
            try:
                feed = db.get_feed(feed_id, self.db_path)
                if not feed:
                    logger.error(f"Feed {feed_id} not found")
                    return {"status": "error", "message": f"Feed {feed_id} not found"}
            except Exception as e:
                logger.error(f"Error checking feed {feed_id}: {e}")
                return {"status": "error", "message": str(e)}
            result = fetcher.fetch_feed(feed_id, self.user_agent, self.db_path)
            return result
        else:
            results = fetcher.fetch_all_active(self.user_agent, self.db_path)
            return results


_scheduler_instance = None


def get_scheduler(db_path=None, user_agent=None):
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = SyncScheduler(db_path, user_agent)
    return _scheduler_instance


def start_sync(db_path=None, user_agent=None):
    scheduler = get_scheduler(db_path, user_agent)
    scheduler.start()
    return scheduler


def stop_sync():
    global _scheduler_instance
    if _scheduler_instance:
        _scheduler_instance.stop()
        _scheduler_instance = None
