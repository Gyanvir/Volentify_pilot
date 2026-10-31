package org.volentify.mesh.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.volentify.mesh.data.DeliveryStatus
import org.volentify.mesh.data.Priority
import org.volentify.mesh.ui.theme.Palette

fun priorityColor(p: Priority): Color = when (p) {
    Priority.CRITICAL -> Palette.Critical
    Priority.HIGH -> Palette.High
    Priority.MEDIUM -> Palette.Moderate
    Priority.LOW -> Palette.Low
}

fun statusColor(s: DeliveryStatus): Color = when (s) {
    DeliveryStatus.QUEUED -> Palette.Moderate
    DeliveryStatus.RELAYED -> Palette.Info
    DeliveryStatus.SYNCING -> Palette.Signal
    DeliveryStatus.SERVER_CONFIRMED -> Palette.Low
    DeliveryStatus.FAILED -> Palette.Critical
}

@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(6.dp).background(color, CircleShape))
        Text(text, color = color, fontSize = 12.sp)
    }
}
