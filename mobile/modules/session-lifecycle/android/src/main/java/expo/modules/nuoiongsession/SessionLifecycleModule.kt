package expo.modules.nuoiongsession

import android.app.Activity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.WeakHashMap

class SessionLifecycleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NuoiOngSessionLifecycle")

    Function("getLaunchId") {
      val activity = appContext.currentActivity ?: return@Function null
      // A development Reload replaces JS/ReactContext but keeps its Activity.
      // A fresh Activity or process is an ordinary app launch, preserving auth.
      synchronized(launches) {
        launches.getOrPut(activity) { UUID.randomUUID().toString() }
      }
    }
  }

  companion object {
    private val launches = WeakHashMap<Activity, String>()
  }
}
