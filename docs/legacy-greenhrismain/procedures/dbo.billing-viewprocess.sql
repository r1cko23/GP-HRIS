
-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[billing-viewprocess] 
	-- Add the parameters for the stored procedure here
	   @idclient int,
	   @keytext2 nvarchar(50)

AS
BEGIN
	
SET NOCOUNT ON;

   CREATE TABLE [#viewbillingprocess3] (
    [IDforbilling] INT IDENTITY(1, 1) PRIMARY KEY,   	
	idclient int,
	billingreference nvarchar(30),
	companyname NVARCHAR(150),
	iddepartment int, 
	departmentdesc NVARCHAR(150),
	date_start date,
	date_end date,
	payrolldate date,
	billingstatus nvarchar(30),
	billingdate date,
	noofemployee int	   	

	
);

-- Insert data first
INSERT INTO [#viewbillingprocess3] 
(
    billingreference, 
    idclient, 
    companyname,
	iddepartment,
	departmentdesc,
    date_start,
    date_end,
    payrolldate,
    billingstatus, 
    billingdate,
    noofemployee
)
SELECT  
    billingreference,
    idclientp,
    companyname, 
	department_codep,
	departmentdesc2,
    
	date_start, 
    date_end, 
    payrolldate,
    billingstatus, 
    billingdate,
    COUNT(idbilling) AS noofemployee 

	FROM View_BILLINGPROCESS
	WHERE idclientp = @idclient 
	AND billingstatus = 'Processed'
	GROUP BY 
    billingreference,
    idclientp, 
    companyname, 
	department_codep,
	departmentdesc2,
    date_start, 
    date_end,
    payrolldate,
    billingstatus, 
    billingdate;

-- Create index AFTER insert (better performance for temp tables)
CREATE INDEX idx_empid 
ON [#viewbillingprocess3] (idclient);

IF @idclient = 159 --aldex setup combine all department group in 1 page
BEGIN
    SELECT
        billingreference,
        idclient,
        companyname,
        0 AS iddepartment,
        'All' AS departmentdesc,
        MIN(date_start) AS date_start,
        MAX(date_end) AS date_end,
        MAX(payrolldate) AS payrolldate,
        billingstatus,
        MAX(billingdate) AS billingdate,
        SUM(noofemployee) AS noofemployee
    FROM #viewbillingprocess3
    GROUP BY
        billingreference,
        idclient,
        companyname,
        billingstatus

END
ELSE
BEGIN
	SELECT *
    FROM #viewbillingprocess3
    WHERE departmentdesc LIKE '%' + @keytext2 + '%'
END

DELETE   FROM #viewbillingprocess3


--------
--DECLARE	@idclient2 int
--DECLARE	@companyname2 NVARCHAR(50)
--DECLARE	@date_start2 date
--DECLARE	@date_end2 date
--DECLARE	@payrolldate2 date
--DECLARE	@datalocked2 nvarchar(5)
--DECLARE	@noofemployee2 int 



/*

DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

--List to be process
SELECT        
	client.idclient, 
	client.companyname, 	
	COUNT(BILLINGTABLE.idpayrollsum) AS noofemployee

FROM BILLINGTABLE INNER JOIN
     client ON BILLINGTABLE.idclientp = client.idclient
WHERE        
	(BILLINGTABLE.datalocked = N'Yes') 
	AND (BILLINGTABLE.transfertoforbilling = N'Y'  or BILLINGTABLE.transfertoforbilling = N'N') 		 --- hereis the condition to get the original total of employee need to process 


GROUP BY 
	client.idclient, 
	client.companyname, 
	BILLINGTABLE.Date_Start, 
	BILLINGTABLE.Date_End, 
	BILLINGTABLE.payrolldate, 
	BILLINGTABLE.datalocked

ORDER BY client.companyname

OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idclient2,@companyname2,@date_start2,@date_end2,@payrolldate2, @datalocked2, @noofemployee2 
	WHILE @@FETCH_STATUS = 0
	
	BEGIN					
	  	

	   update #BILLINGTABLE3
	   set totalnoofemployee = 	@noofemployee2
	   where idclient = @idclient2 and date_start = @date_start2 and payrolldate = @payrolldate2

		
						
	FETCH NEXT FROM myCursor3 INTO @idclient2,@companyname2,@date_start2,@date_end2,@payrolldate2, @datalocked2, @noofemployee2 
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	   	  -------------------- End updating  Process-----------------------------------------


*/





END



