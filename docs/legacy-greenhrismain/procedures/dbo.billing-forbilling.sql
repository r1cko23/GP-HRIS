
-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[billing-forbilling] 
	-- Add the parameters for the stored procedure here
		 @keytext varchar(50)
AS
BEGIN
	
SET NOCOUNT ON;

   CREATE TABLE #payroll_summary3 (
    [IDforbilling] INT IDENTITY(1, 1) PRIMARY KEY,   	
	idclient int,
	companyname NVARCHAR(150),
	idbranch int,
	branch nvarchar(100),
	iddepartment int, 
	departmentdesc nvarchar(100),
	date_start date,
	date_end date,
	payrolldate date,
	trxtype	nvarchar(20),
	datalocked nvarchar(5),
	grandtotalnoofemployee int, 
	totalnoofemployee int,
	remainingnoofemployee int default 0,  
	awaitingtag int	

								   							   							 	
);

CREATE INDEX idx_empid ON [#payroll_summary3] (idclient);

INSERT INTO [#payroll_summary3] 
(idclient
,companyname
,idbranch
,branch
,iddepartment
,departmentdesc
,date_start
,date_end
,payrolldate
,trxtype
,datalocked
,totalnoofemployee)

SELECT        
client.idclient
,client.companyname
,client_branch.idclientbranch
,client_branch.branch
,payroll_summary.department_codep
,payroll_summary.departmentdesc2
,payroll_summary.Date_Start
,payroll_summary.Date_End
,payroll_summary.payrolldate
,payroll_summary.trxtypep
,payroll_summary.datalocked
,COUNT(payroll_summary.idpayrollsum) AS totalnoofemployee 
                
FROM            payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient INNER JOIN
                         client_branch ON payroll_summary.idclientbranchp = client_branch.idclientbranch
WHERE       
	(payroll_summary.datalocked = N'Yes')
	and Date_Start >='2025-11-01'
	AND (payroll_summary.transfertoforbilling = N'Y'  or payroll_summary.transfertoforbilling = N'N')
	and databillingstatus = 'Ok'--- hereis the condition to get the original total of employee need to process 
	and idclientp IN (105,1187,102,159)
	


	
GROUP BY 
	client.idclient, 
	client_branch.idclientbranch,
	client.companyname,
	client_branch.branch,
	payroll_summary.department_codep,
	payroll_summary.departmentdesc2,
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate,
	payroll_summary.trxtypep,	
	payroll_summary.datalocked	   
ORDER BY Date_Start,client.companyname,branch



--Total remaining available for billing -------
DECLARE	@idclient2 int
DECLARE	@companyname2 NVARCHAR(100)
DECLARE	@idbranch2 int
DECLARE	@branch2 NVARCHAR(100)
DECLARE	@iddepartment2 int
DECLARE	@departmentdesc2 NVARCHAR(100)
DECLARE	@date_start2 date
DECLARE	@date_end2 date
DECLARE	@payrolldate2 date
DECLARE	@datalocked2 nvarchar(5)
DECLARE	@noofemployee2 int 
DECLARE	@remainingnoofemployee2 int

-- process number of employee to process 
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      



SELECT        
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch,
	payroll_summary.department_codep, 
	payroll_summary.departmentdesc2, 
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked, 
	COUNT(payroll_summary.idpayrollsum) AS remainingnoofemployee

FROM            payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient INNER JOIN
                         client_branch ON payroll_summary.idclientbranchp = client_branch.idclientbranch
WHERE        
	(payroll_summary.datalocked = N'Yes')
	and Date_Start >='2025-05-01'
	AND (payroll_summary.transfertoforbilling = N'Y'  or payroll_summary.transfertoforbilling = N'N') 
	AND (payroll_summary.transfertoforbillingfinal = N'N')


GROUP BY 
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch, 
	payroll_summary.department_codep,
	payroll_summary.departmentdesc2,
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked

ORDER BY client.companyname

OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idclient2,@companyname2,@idbranch2,@branch2,@iddepartment2,@departmentdesc2,@date_start2,@date_end2,@payrolldate2, @datalocked2, @remainingnoofemployee2 
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  	

	   update #payroll_summary3
	   set remainingnoofemployee = 	@remainingnoofemployee2
	   where idclient = @idclient2 and idbranch = @idbranch2 and  iddepartment = @iddepartment2 and date_start = @date_start2 and payrolldate = @payrolldate2

		
						
	FETCH NEXT FROM myCursor3 INTO @idclient2,@companyname2,@idbranch2,@branch2,@iddepartment2,@departmentdesc2,@date_start2,@date_end2,@payrolldate2, @datalocked2, @remainingnoofemployee2 
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	   	  -------------------- End updating Total remaining for billing   Process-----------------------------------------





 --Awaiting Tag -------------------------------------------------------------------------------------------------------------
DECLARE @idclient4 int
DECLARE	@companyname4 NVARCHAR(100)
DECLARE	@idbranch4 int
DECLARE	@branch4 NVARCHAR(100)
DECLARE	@iddepartment4 int
DECLARE	@deparmentdesc4 NVARCHAR(100)
DECLARE	@date_start4 date
DECLARE	@date_end4 date
DECLARE	@payrolldate4 date
DECLARE	@datalocked4 nvarchar(5)
DECLARE	@awaitingtag4 int

-- process number of employee to process 
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      
				 				 
SELECT        
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch,
	payroll_summary.department_codep,
	payroll_summary.departmentdesc2,
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked, 
	COUNT(payroll_summary.idpayrollsum) AS Awaitingtag

FROM            payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient INNER JOIN
                         client_branch ON payroll_summary.idclientbranchp = client_branch.idclientbranch
WHERE        
	(payroll_summary.datalocked = N'No') 
	and Date_Start >='2025-05-01'
	


GROUP BY 
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch, 
	payroll_summary.department_codep, 
	payroll_summary.departmentdesc2, 
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked

ORDER BY client.companyname

OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idclient4,@companyname4,@idbranch4,@branch4,@iddepartment4,@deparmentdesc4,@date_start4,@date_end4,@payrolldate4, @datalocked4, @awaitingtag4
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  	

	   update #payroll_summary3
	   set awaitingtag = 	@awaitingtag4
	   where idclient = @idclient4 and idbranch = @idbranch4 and iddepartment = @iddepartment4 and  date_start = @date_start4 and payrolldate = @payrolldate4

		
						
	FETCH NEXT FROM myCursor4 INTO @idclient4,@companyname4,@idbranch4,@branch4,@iddepartment4,@deparmentdesc4, @date_start4,@date_end4,@payrolldate4, @datalocked4, @awaitingtag4
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4


 --End Awating tag ----------------------------------------------------------------------------------





--Total Employee 

DECLARE @idclient5 int
DECLARE	@companyname5 NVARCHAR(100)
DECLARE	@idbranch5 int
DECLARE	@branch5 NVARCHAR(100)
DECLARE	@iddepartment5 int
DECLARE	@departmentdesc5 NVARCHAR(100)
DECLARE	@date_start5 date
DECLARE	@date_end5 date
DECLARE	@payrolldate5 date
DECLARE	@datalocked5 nvarchar(5)
DECLARE	@grandtotalnoofemmployee5 int

-- process number of employee to process 
DECLARE myCursor5 CURSOR FOR
-- open payroll summary      
				 				 
SELECT        
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch,
	payroll_summary.department_codep, 
	payroll_summary.departmentdesc2, 	
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked, 
	COUNT(payroll_summary.idpayrollsum) AS totalemployee

FROM            payroll_summary INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient INNER JOIN
                         client_branch ON payroll_summary.idclientbranchp = client_branch.idclientbranch
--WHERE        
--	(payroll_summary.datalocked = N'No') 
	


GROUP BY 
	client.idclient, 
	client.companyname,
	client_branch.idclientbranch,
	client_branch.branch,
	payroll_summary.department_codep, 	
	payroll_summary.departmentdesc2, 	
	payroll_summary.Date_Start, 
	payroll_summary.Date_End, 
	payroll_summary.payrolldate, 
	payroll_summary.datalocked

ORDER BY client.companyname

OPEN myCursor5
   
   FETCH NEXT FROM myCursor5 INTO @idclient5,@companyname5,@idbranch5,@branch5, @iddepartment5,@departmentdesc5,@date_start5,@date_end5,@payrolldate5, @datalocked5, @grandtotalnoofemmployee5
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  	

	   update #payroll_summary3
	   set grandtotalnoofemployee = 	@grandtotalnoofemmployee5
	   where idclient = @idclient5 and idbranch = @idbranch5 and iddepartment = @iddepartment5 and date_start = @date_start5 and payrolldate = @payrolldate5

		
						
	FETCH NEXT FROM myCursor5 INTO @idclient5,@companyname5,@idbranch5,@branch5, @iddepartment5,@departmentdesc5, @date_start5,@date_end5,@payrolldate5, @datalocked5, @grandtotalnoofemmployee5
	END
	CLOSE myCursor5
	DEALLOCATE myCursor5



--End Getting total employees 




SELECT *
FROM #payroll_summary3
WHERE remainingnoofemployee <> 0
AND (companyname LIKE '%' + @keytext + '%'	 or departmentdesc  LIKE '%' + @keytext + '%')
ORDER BY date_start DESC;

delete from #payroll_summary3


END



