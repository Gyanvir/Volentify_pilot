package org.volentify.mesh

import android.app.Application
import org.volentify.mesh.sync.GatewaySync

class VolentifyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        GatewaySync.schedulePeriodic(this)
    }
}
