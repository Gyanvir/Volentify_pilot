package org.volentify.mesh

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import org.volentify.mesh.mesh.BleMeshService
import org.volentify.mesh.mesh.MeshPermissions
import org.volentify.mesh.ui.HomeScreen
import org.volentify.mesh.ui.MeshViewModel
import org.volentify.mesh.ui.ReportScreen
import org.volentify.mesh.ui.SettingsScreen
import org.volentify.mesh.ui.theme.Palette
import org.volentify.mesh.ui.theme.VolentifyTheme

enum class Screen { Home, Report, Settings }

class MainActivity : ComponentActivity() {
    private val vm: MeshViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VolentifyTheme {
                var screen by remember { mutableStateOf(Screen.Home) }
                var permissionsAsked by remember { mutableStateOf(false) }
                val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
                    if (vm.settings.meshEnabled && MeshPermissions.bluetoothGranted(this)) BleMeshService.start(this)
                }
                LaunchedEffect(Unit) {
                    if (MeshPermissions.bluetoothGranted(this@MainActivity)) {
                        if (vm.settings.meshEnabled) BleMeshService.start(this@MainActivity)
                    } else if (!permissionsAsked) {
                        permissionsAsked = true
                        launcher.launch(MeshPermissions.required())
                    }
                }
                BackHandler(enabled = screen != Screen.Home) { screen = Screen.Home }
                Surface(color = Palette.Ink, modifier = Modifier.fillMaxSize()) {
                    Box(Modifier.safeDrawingPadding()) {
                        when (screen) {
                            Screen.Home -> HomeScreen(
                                vm = vm,
                                onNewReport = { screen = Screen.Report },
                                onSettings = { screen = Screen.Settings },
                                onGrantPermissions = { launcher.launch(MeshPermissions.required()) },
                            )
                            Screen.Report -> ReportScreen(vm = vm, onClose = { screen = Screen.Home })
                            Screen.Settings -> SettingsScreen(vm = vm, onClose = { screen = Screen.Home })
                        }
                    }
                }
            }
        }
    }
}
