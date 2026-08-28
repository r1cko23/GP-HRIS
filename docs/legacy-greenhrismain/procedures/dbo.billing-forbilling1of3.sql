
-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[billing-forbilling1of3] 
	-- Add the parameters for the stored procedure here
	@idclient int,
	@idbranch int, 
	@datestart date,
	@dateend date,
	@sheetname nvarchar(100),
	@iddepartment nvarchar(100)

	
AS
BEGIN
	
	SET NOCOUNT ON;

if (@sheetname<> '') 
BEGIN

SELECT      client.idclient
,client.companyname
, payroll_summary.Date_Start
, payroll_summary.Date_End
, FORMAT(payroll_summary.payrolldate, 'MM/dd/yyyy') AS payrolldate
, payroll_summary.datalocked
, payroll_summary.idpayrollsum
, payroll_summary.lname2
, payroll_summary.fname2
, payroll_summary.mname2
, payroll_summary.Employee_id
, payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N' ' + payroll_summary.mname2 AS empname
, client_branch_position.BillingDepartment
, payroll_summary.idbranchpositionp
, payroll_summary.jobposition2

,CASE  
		WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
		WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
END AS noofhourswork

, payroll_summary.idclientbranchp
, payroll_summary.groupnamenew
, payroll_summary.sheetnamenew
, client_branch_position.jobposition
, payroll_summary.fixrate
, dailyrate_payroll

FROM            client_branch_position INNER JOIN
                         client_branch INNER JOIN
                         payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient ON 
						 client_branch.idclientbranch = payroll_summary.idclientbranchp ON
						 client_branch_position.idbranchposition = payroll_summary.idbranchpositionp
WHERE        
(payroll_summary.datalocked = N'Yes')	  
and idclientp  = @idclient	
and transfertoforbilling = 'Y'
and transfertoforbillingfinal = 'N'
and Date_Start = @datestart
and sheetnamenew = @sheetname 
and Date_End = @dateend
order by transfersorting

END

if (@sheetname='') 
BEGIN

SELECT      client.idclient
,client.companyname
, payroll_summary.Date_Start
, payroll_summary.Date_End
, FORMAT(payroll_summary.payrolldate, 'MM/dd/yyyy') AS payrolldate
, payroll_summary.datalocked
, payroll_summary.idpayrollsum
, payroll_summary.lname2
, payroll_summary.fname2
, payroll_summary.mname2
, payroll_summary.Employee_id
, payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N' ' + payroll_summary.mname2 AS empname
, client_branch_position.BillingDepartment
, payroll_summary.idbranchpositionp
, payroll_summary.jobposition2

,CASE  
		WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
		WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
END AS noofhourswork

, payroll_summary.idclientbranchp
, payroll_summary.groupnamenew
, payroll_summary.sheetnamenew
, client_branch_position.jobposition
, payroll_summary.fixrate
, dailyrate_payroll

FROM            client_branch_position INNER JOIN
                         client_branch INNER JOIN
                         payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient ON 
						 client_branch.idclientbranch = payroll_summary.idclientbranchp ON
						 client_branch_position.idbranchposition = payroll_summary.idbranchpositionp
WHERE        
(payroll_summary.datalocked = N'Yes')	  
and idclientp  = @idclient	
and transfertoforbilling = 'Y'
and transfertoforbillingfinal = 'N'
and Date_Start = @datestart
and Date_End = @dateend
and department_codep = @iddepartment

order by transfersorting

END




END



