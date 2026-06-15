package logger

import (
	"fmt"
	"strings"

	"go.uber.org/fx/fxevent"
)

type FXEventLogger struct {
	log *Logger
}

func NewFXEventLogger(log *Logger) *FXEventLogger {
	return &FXEventLogger{log: log}
}

var _ fxevent.Logger = (*FXEventLogger)(nil)

func (l *FXEventLogger) LogEvent(event fxevent.Event) {
	switch e := event.(type) {
	case *fxevent.OnStartExecuting:
		l.log.Debugf("[Fx] HOOK OnStart\t\t%s executing (caller: %s)", e.FunctionName, e.CallerName)
	case *fxevent.OnStartExecuted:
		if e.Err != nil {
			l.log.Errorf("[Fx] HOOK OnStart\t\t%s called by %s failed in %s: %+v", e.FunctionName, e.CallerName, e.Runtime, e.Err)
		} else {
			l.log.Debugf("[Fx] HOOK OnStart\t\t%s called by %s ran successfully in %s", e.FunctionName, e.CallerName, e.Runtime)
		}
	case *fxevent.OnStopExecuting:
		l.log.Infof("[Fx] HOOK OnStop\t\t%s executing", e.FunctionName)
	case *fxevent.OnStopExecuted:
		if e.Err != nil {
			l.log.Errorf("[Fx] HOOK OnStop\t\t%s failed in %s: %+v", e.FunctionName, e.Runtime, e.Err)
		} else {
			l.log.Infof("[Fx] HOOK OnStop\t\t%s ran successfully in %s", e.FunctionName, e.Runtime)
		}
	case *fxevent.Supplied:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\tFailed to supply %v: %+v", e.TypeName, e.Err)
		} else if e.ModuleName != "" {
			l.log.Debugf("[Fx] SUPPLY\t%v from module %q", e.TypeName, e.ModuleName)
		} else {
			l.log.Debugf("[Fx] SUPPLY\t%v", e.TypeName)
		}
	case *fxevent.Provided:
		privateStr := ""
		if e.Private {
			privateStr = " (PRIVATE)"
		}
		for _, rtype := range e.OutputTypeNames {
			if e.ModuleName != "" {
				l.log.Debugf("[Fx] PROVIDE%s\t%v <= %v from module %q", privateStr, rtype, e.ConstructorName, e.ModuleName)
			} else {
				l.log.Debugf("[Fx] PROVIDE%s\t%v <= %v", privateStr, rtype, e.ConstructorName)
			}
		}
		if e.Err != nil {
			l.log.Errorf("[Fx] Error after options were applied: %+v", e.Err)
		}
	case *fxevent.Replaced:
		for _, rtype := range e.OutputTypeNames {
			if e.ModuleName != "" {
				l.log.Debugf("[Fx] REPLACE\t%v from module %q", rtype, e.ModuleName)
			} else {
				l.log.Debugf("[Fx] REPLACE\t%v", rtype)
			}
		}
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\tFailed to replace: %+v", e.Err)
		}
	case *fxevent.Decorated:
		for _, rtype := range e.OutputTypeNames {
			if e.ModuleName != "" {
				l.log.Debugf("[Fx] DECORATE\t%v <= %v from module %q", rtype, e.DecoratorName, e.ModuleName)
			} else {
				l.log.Debugf("[Fx] DECORATE\t%v <= %v", rtype, e.DecoratorName)
			}
		}
		if e.Err != nil {
			l.log.Errorf("[Fx] Error after options were applied: %+v", e.Err)
		}
	case *fxevent.BeforeRun:
		moduleStr := ""
		if e.ModuleName != "" {
			moduleStr = fmt.Sprintf(" from module %q", e.ModuleName)
		}
		l.log.Debugf("[Fx] BEFORE RUN\t%s: %s%s", e.Kind, e.Name, moduleStr)
	case *fxevent.Run:
		moduleStr := ""
		if e.ModuleName != "" {
			moduleStr = fmt.Sprintf(" from module %q", e.ModuleName)
		}
		l.log.Debugf("[Fx] RUN\t%v: %v in %s%v", e.Kind, e.Name, e.Runtime, moduleStr)
		if e.Err != nil {
			l.log.Errorf("[Fx] Error returned: %+v", e.Err)
		}
	case *fxevent.Invoking:
		if e.ModuleName != "" {
			l.log.Debugf("[Fx] INVOKE\t\t%s from module %q", e.FunctionName, e.ModuleName)
		} else {
			l.log.Debugf("[Fx] INVOKE\t\t%s", e.FunctionName)
		}
	case *fxevent.Invoked:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\t\tfx.Invoke(%v) called from:\n%+vFailed: %+v", e.FunctionName, e.Trace, e.Err)
		}
	case *fxevent.Stopping:
		l.log.Infof("[Fx] %v", strings.ToUpper(e.Signal.String()))
	case *fxevent.Stopped:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\t\tFailed to stop cleanly: %+v", e.Err)
		} else {
			l.log.Infof("[Fx] STOPPED")
		}
	case *fxevent.RollingBack:
		l.log.Errorf("[Fx] ERROR\t\tStart failed, rolling back: %+v", e.StartErr)
	case *fxevent.RolledBack:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\t\tCouldn't roll back cleanly: %+v", e.Err)
		}
	case *fxevent.Started:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\t\tFailed to start: %+v", e.Err)
		} else {
			l.log.Infof("[Fx] RUNNING")
		}
	case *fxevent.LoggerInitialized:
		if e.Err != nil {
			l.log.Errorf("[Fx] ERROR\t\tFailed to initialize custom logger: %+v", e.Err)
		} else {
			l.log.Debugf("[Fx] LOGGER\tInitialized custom logger from %v", e.ConstructorName)
		}
	}
}
