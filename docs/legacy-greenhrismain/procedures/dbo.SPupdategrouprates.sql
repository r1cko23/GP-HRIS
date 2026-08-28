-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-2-2024>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
CREATE PROCEDURE [dbo].[SPupdategrouprates]	
-- Add the parameters for the stored procedure here
		
	@idclient int,
	@filtername nvarchar(50),
	@filteramt float,
	@filterupdate float,
	@fixrate nvarchar(1)
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	IF @filtername = 'Daily Rate'
		update client_branch_position
		set newrate = @filterupdate,withchange = 'Y'
		where  dailyratepayroll = @filteramt and idclient = @idclient and fixrate = @fixrate
	IF @filtername = 'Reg OT Rate'
	update client_branch_position
		set regularOTrate = @filterupdate
		where  regularOTrate = @filteramt and idclient = @idclient	  and fixrate = @fixrate
	
	IF @filtername = 'Night Diff Rate'
	update client_branch_position
		set nightdiffrate = @filterupdate
		where  nightdiffrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'Reg Night Diff OT'
	update client_branch_position
		set regularnightdiffOTrate = @filterupdate
		where  regularnightdiffOTrate = @filteramt and idclient = @idclient	 and fixrate = @fixrate
	
	
	IF @filtername = 'Legal Holiday Rate'
	update client_branch_position
		set legalholidayrate = @filterupdate
		where  legalholidayrate = @filteramt and idclient = @idclient  and fixrate = @fixrate

	IF @filtername = 'Legal Holiday OT Rate'
	update client_branch_position
		set legalholidayOTrate = @filterupdate
		where  legalholidayOTrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'Legal Holiday ND Rate'
	update client_branch_position
		set legalholidayNDrate = @filterupdate
		where  legalholidayNDrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'Legal Holiday OTND Rate'
	update client_branch_position
		set lhotndrate = @filterupdate
		where  lhotndrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'Special Holiday Rate'
	update client_branch_position
		set specialholidayrate = @filterupdate
		where  specialholidayrate = @filteramt and idclient = @idclient	 and fixrate = @fixrate

	IF @filtername = 'Special Holiday OT Rate'
	update client_branch_position
		set specialholidayOTrate = @filterupdate
		where  specialholidayOTrate = @filteramt and idclient = @idclient  and fixrate = @fixrate
	
	IF @filtername = 'Special Holiday Night Diff Rate'
		update client_branch_position
		set specialholidaynightdiffrate = @filterupdate
		where  specialholidaynightdiffrate = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'SHOTND Rate'
		update client_branch_position
		set shotndrate = @filterupdate
		where  shotndrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'SHOTND Rate'
		update client_branch_position
		set shotndrate = @filterupdate
		where  shotndrate = @filteramt and idclient = @idclient	and fixrate = @fixrate

	IF @filtername = 'WDO/RD'
		update client_branch_position
		set WDOrate = @filterupdate
		where  WDOrate = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'WDO/RD OT'
		update client_branch_position
		set rdotrate = @filterupdate
		where  rdotrate = @filteramt and idclient = @idclient and fixrate = @fixrate
	
	IF @filtername = 'WDO/RD ND'
		update client_branch_position
		set rdndrate = @filterupdate
		where  rdndrate = @filteramt and idclient = @idclient and fixrate = @fixrate
		

	IF @filtername = 'LHWDO RATE'
		update client_branch_position
		set LHWDORATE = @filterupdate
		where  LHWDORATE = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'LHWDO OT RATE'
		update client_branch_position
		set LHWDOOTRATE = @filterupdate
		where  LHWDOOTRATE = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'LHWDO ND RATE'
		update client_branch_position
		set LHWDONDRATE = @filterupdate
		where  LHWDONDRATE = @filteramt and idclient = @idclient and fixrate = @fixrate

		
	IF @filtername = 'LHWDO OTND RATE'
		update client_branch_position
		set LHWDOOTNDRATE = @filterupdate
		where  LHWDOOTNDRATE = @filteramt and idclient = @idclient	and fixrate = @fixrate


	IF @filtername = 'WDOSH RATE'
		update client_branch_position
		set WDOSHRATE = @filterupdate
		where  WDOSHRATE = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'WDOSH OT RATE'
		update client_branch_position
		set WDOSHOTRATE = @filterupdate
		where  WDOSHOTRATE = @filteramt and idclient = @idclient and fixrate = @fixrate

	IF @filtername = 'WDOSH ND RATE'
		update client_branch_position
		set WDOSHNDRATE = @filterupdate
		where  WDOSHNDRATE = @filteramt and idclient = @idclient  and fixrate = @fixrate

	IF @filtername = 'WDOSH OTND RATE'
		update client_branch_position
		set WDOSHOTNDRATE = @filterupdate
		where  WDOSHOTNDRATE = @filteramt and idclient = @idclient and fixrate = @fixrate

END

