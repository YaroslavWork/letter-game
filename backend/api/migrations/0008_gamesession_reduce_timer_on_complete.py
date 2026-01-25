# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_gamesession_round_timer'),
    ]

    operations = [
        migrations.AddField(
            model_name='gamesession',
            name='reduce_timer_on_complete_seconds',
            field=models.IntegerField(default=15, help_text='Reduce timer to this many seconds when a player completes all categories (if time left is greater)'),
        ),
    ]
